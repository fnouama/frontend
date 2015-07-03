import ko from 'knockout';
import _ from 'underscore';
import * as vars from 'modules/vars';
import {combine} from 'utils/array';
import internalPageCode from 'utils/internal-page-code';
import parseQueryParams from 'utils/parse-query-params';
import urlAbsPath from 'utils/url-abs-path';
import Article from 'models/collections/article';
import autoComplete from 'modules/auto-complete';
import * as cache from 'modules/cache';
import * as contentApi from 'modules/content-api';
import debounce from 'utils/debounce';
import EventEmitter from 'EventEmitter';

var pollerSym = Symbol();
var debounceSym = Symbol();
var fetchSym = Symbol();

class Latest extends EventEmitter {
    constructor(options) {
        super();
        var opts = this.opts = options || {};

        var pageSize = vars.CONST.searchPageSize || 25,
            showingDrafts = opts.showingDrafts;

        this.articles = ko.observableArray();
        this.message = ko.observable();

        this.term = ko.observable(parseQueryParams().q || '');
        this.term.subscribe(() => this.search());

        this.filter = ko.observable();

        this.suggestions = ko.observableArray();
        this.lastSearch = ko.observable();

        this.page = ko.observable(1);
        this.totalPages = ko.observable(1);

        this.title = ko.computed(() => {
            var lastSearch = this.lastSearch(),
                title = 'latest';
            if (lastSearch && lastSearch.filter) {
                title += ' in ' + lastSearch.filter;
            }
            return title;
        }, this);

        this[debounceSym] = debounce((opts = {}) => {
            if (this.suggestions().length) {
                // The auto complete is open, if we ask the API most likely we won't get any result
                // which will lead to displaying the alert
                return;
            }
            if (!opts.noFlushFirst) {
                this.flush('searching...');
            }

            var request = {
                isDraft: showingDrafts(),
                page: this.page(),
                pageSize: pageSize,
                filter: this.filter(),
                filterType: this.filterType().param,
                isPoll: opts.isPoll
            };

            var term = this.term();
            // If term contains slashes, assume it's an article id (and first convert it to a path)
            if (this.isTermAnItem()) {
                term = urlAbsPath(term);
                this.term(term);
                request.article = term;
            } else {
                request.term = term;
            }

            return contentApi.fetchLatest(request);
        }, vars.CONST.searchDebounceMs);

        this.showNext = ko.pureComputed(function () {
            return this.totalPages() > this.page();
        }, this);

        this.showPrev = ko.pureComputed(function () {
            return this.page() > 1;
        }, this);

        this.showTop = ko.pureComputed(function () {
            return this.page() > 2;
        }, this);
    }

    [fetchSym](request) {
        var loadCallback = this.opts.callback || function () {};

        this[debounceSym](request)
        .then(({
            results,
            pages,
            currentPage
        }) => {
            var scrollable = this.opts.container.querySelector('.scrollable'),
                initialScroll = scrollable.scrollTop;

            this.lastSearch(request);
            this.totalPages(pages);
            this.page(currentPage);

            if (results.length) {
                let newArticles = combine(results, this.articles(), compareArticles, createNewArticle, reuseOldArticle);
                this.articles(newArticles);
                this.message(null);
            } else {
                this.flush('...sorry, no articles were found.');
            }

            scrollable.scrollTop = initialScroll;
            loadCallback();
            this.emit('search:update');
        })
        .catch((error = {
            message: 'Invalid CAPI result. Please try again'
        }) => {
            var errMsg = error.message;
            vars.model.alert(errMsg);
            this.flush(errMsg);
            loadCallback();
            this.emit('search:update');
        });
    }

    isTermAnItem() {
        return (this.term() || '').match(/\//);
    }

    setFilter(item) {
        this.filter(item && item.id ? item.id : item);
        this.suggestions.removeAll();
        this.filterChange();
        this.search();
    }

    clearFilter() {
        this.filter('');
        this.suggestions.removeAll();
    }

    clearTerm() {
        this.term('');
    }

    autoComplete() {
        autoComplete({
            query: this.filter(),
            path: (this.filterType() || {}).path
        })
        .progress(this.suggestions)
        .then(this.suggestions);
    }

    filterChange() {
        if (!this.filter()) {
            var lastSearch = this.lastSearch();
            if (lastSearch && lastSearch.filter) {
                // The filter has been cleared
                this.search();
            }
        }
    }

    startPoller() {
        this[pollerSym] = setInterval(() => {
            if (this.page() === 1) {
                this.search({
                    noFlushFirst: true,
                    isPoll: true
                });
            }
        }, vars.CONST.latestArticlesPollMs || 60000);

        this.startPoller = function() {}; // make idempotent
    }

    search(opts) {
        this.page(1);
        this[fetchSym](opts);

        return true; // ensure default click happens on all the bindings
    }

    flush(message) {
        this.articles.removeAll();
        this.message(message);
    }

    refresh() {
        this.page(1);
        this[fetchSym]();
    }

    reset() {
        this.page(1);
        this.clearTerm();
        this.clearFilter();
    }

    pageNext() {
        this.page(this.page() + 1);
        this[fetchSym]();
    }

    pagePrev() {
        this.page(_.max([1, this.page() - 1]));
        this[fetchSym]();
    }

    dispose() {
        this[debounceSym].dispose();
        clearInterval(this[pollerSym]);
    }
}

function compareArticles (one, two) {
    var oneId = one instanceof Article ? one.id() : internalPageCode(one);
    var twoId = two instanceof Article ? two.id() : internalPageCode(two);
    return oneId === twoId;
}

function createNewArticle (opts) {
    var icc = internalPageCode(opts);

    opts.id = icc;
    cache.put('contentApi', icc, opts);

    opts.uneditable = true;
    return new Article(opts, true);
}

function reuseOldArticle (oldArticle, newArticle) {
    oldArticle.props.webPublicationDate(newArticle.webPublicationDate);
    return oldArticle;
}

export default Latest;
