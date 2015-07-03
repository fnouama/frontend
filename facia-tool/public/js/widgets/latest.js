import ko from 'knockout';
import _ from 'underscore';
import BaseWidget from 'widgets/base-widget';
import LatestArticles from 'models/collections/latest-articles';
import mediator from 'utils/mediator';
import updateScrollables from 'utils/update-scrollables';

// TODO extend from a base widget
class Latest extends BaseWidget {
    constructor(params, element) {
        this.column = params.column;

        this.showingDrafts = ko.observable(false);

        this.latestArticles = new LatestArticles({
            container: element,
            showingDrafts: this.showingDrafts,
            callback: _.once(function () {
                mediator.emit('latest:loaded');
            })
        });

        this.latestArticles.search();
        this.latestArticles.startPoller();

        this.listeners = mediator.scope();
        this.listeners.on('switches:change', switches => {
            if (this.showingDrafts() && !switches['facia-tool-draft-content']) {
                this.showLive();
            }
        });
        this.subscriptionOnArticles = this.latestArticles.articles.subscribe(updateScrollables);
    }

    showDrafts() {
        this.showingDrafts(true);
        this.latestArticles.search();
    }

    showLive() {
        this.showingDrafts(false);
        this.latestArticles.search();
    }


    dispose() {
        this.subscriptionOnArticles.dispose();
        this.listeners.dispose();
        this.latestArticles.dispose();
    }
}

export default Latest;
