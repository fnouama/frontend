define([
    'knockout',
    'underscore',
    'models/config/persistence',
    'modules/vars',
    'modules/content-api',
    'utils/sanitize-api-query',
    'utils/as-observable-props',
    'utils/populate-observables',
    'utils/full-trim',
    'utils/mediator',
    'utils/url-abs-path',
    'utils/identity'
], function(
    ko,
    _,
    persistence,
    vars,
    contentApi,
    sanitizeApiQuery,
    asObservableProps,
    populateObservables,
    fullTrim,
    mediator,
    urlAbsPath,
    identity
) {
    fullTrim = fullTrim.default;
    sanitizeApiQuery = sanitizeApiQuery.default;
    urlAbsPath = urlAbsPath.default;
    asObservableProps = asObservableProps.default;
    populateObservables = populateObservables.default;
    mediator = mediator.default;
    persistence = persistence.default;

    var checkCount = 0;

    function Collection(opts) {
        opts = opts || {};

        this.id = opts.id;

        this.parents = ko.observableArray();

        this.capiResults = ko.observableArray();

        this.meta = asObservableProps([
            'displayName',
            'href',
            'groups',
            'type',
            'uneditable',
            'showTags',
            'showSections',
            'hideKickers',
            'showDateHeader',
            'showLatestUpdate',
            'showTimestamps',
            'excludeFromRss',
            'apiQuery',
            'description']);

        populateObservables(this.meta, opts);

        this.state = asObservableProps([
            'isOpen',
            'isOpenTypePicker',
            'underDrag',
            'underControlDrag',
            'apiQueryStatus']);

        this.state.withinPriority = ko.computed(function() {
            return _.some(this.parents(), function(front) {return front.props.priority() === vars.priority; });
        }, this);

        this.containerThumbnail = ko.computed(function () {
            var containerId = this.meta.type();

            if (/^(fixed|dynamic)\//.test(containerId)) {
                return '/thumbnails/' + containerId + '.svg';
            } else {
                return null;
            }
        }, this);

        this.meta.apiQuery.subscribe(function(apiQuery) {
            if (this.state.isOpen()) {
                this.meta.apiQuery(apiQuery.replace(/\s+/g, ''));
                this.checkApiQueryStatus();
            }
        }, this);

        this.meta.type.subscribe(function(type) {
            this.meta.groups(
                (_.find(vars.CONST.types, function(t) { return t.name === type; }) || {})
                .groups
            );
        }, this);

        this.typePicker = this._typePicker.bind(this);
    }

    Collection.prototype.toggleOpen = function() {
        this.state.isOpen(!this.state.isOpen());
    };

    Collection.prototype.toggleOpenTypePicker = function() {
        this.state.isOpenTypePicker(!this.state.isOpenTypePicker());
    };

    Collection.prototype._typePicker = function(type) {
        this.meta.type(type);
        this.state.isOpenTypePicker(false);
    };

    Collection.prototype.close = function() {
        this.state.isOpen(false);
    };

    /** IDs of fronts to which the collection belongs */
    Collection.prototype.frontIds = function () {
        return _.chain(this.parents()).map(function (front) {
            return front.id();
        }).filter(identity).value();
    };

    Collection.prototype.save = function() {
        var self = this,
            errs = _.chain([
                    {key: 'displayName', errMsg: 'enter a title'},
                    {key: 'type', errMsg: 'choose a layout'}
                ])
                .filter(function(test) { return !fullTrim(_.result(self.meta, test.key)); })
                .pluck('errMsg')
                .value();

        if (errs.length) {
            window.alert('Oops! You must ' + errs.join(', and ') + '...');
            return;
        }

        this.meta.href(urlAbsPath(this.meta.href()));
        this.meta.apiQuery(sanitizeApiQuery(this.meta.apiQuery()));

        this.state.apiQueryStatus(undefined);
        this.state.isOpen(false);

        if (vars.model.collections.indexOf(this) === -1) {
            vars.model.collections.unshift(this);
        }

        persistence.collection.save(this);
    };

    Collection.prototype.checkApiQueryStatus = function() {
        var self = this,
            apiQuery = this.meta.apiQuery(),
            cc;

        this.capiResults.removeAll();

        if (!apiQuery) {
            this.state.apiQueryStatus(undefined);
            return;
        }

        this.state.apiQueryStatus('check');

        checkCount += 1;
        cc = checkCount;

        apiQuery += apiQuery.indexOf('?') < 0 ? '?' : '&';
        apiQuery += 'show-fields=headline';

        contentApi.fetchContent(apiQuery)
        .then(function(res) {
            if (cc === checkCount) {
                var results = res && res.content;
                self.capiResults(results || []);
                self.state.apiQueryStatus(results && results.length ? 'valid' : 'invalid');
            }
        });
    };

    Collection.prototype.drop = function (source, targetGroup) {
        mediator.emit('collection:updates', {
            sourceItem: source.sourceItem,
            sourceGroup: source.sourceGroup,
            targetItem: this,
            targetGroup: targetGroup,
            isAfter: false,
            mediaItem: null
        });
    };

    return Collection;
});
