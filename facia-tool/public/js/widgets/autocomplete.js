import ko from 'knockout';
import _ from 'underscore';
import BaseWidget from 'widgets/base-widget';
import autocomplete from 'modules/auto-complete';
import debounce from 'utils/debounce';
import {CONST} from 'modules/vars';

var typeBounceSym = Symbol();

class AutoComplete extends BaseWidget {
    constructor() {
        super();

        this.suggestions = ko.observableArray();
        this.filterType = ko.observable();
        this.filterTypes = ko.observableArray(_.values(CONST.filterTypes) || []);
        this.alertMessage = ko.observable(false);
        this.filter = ko.observable('');
        this.subscribeOn(this.filter, this.type);
        this.open = ko.pureComputed(() => {
            return this.alertMessage() || this.suggestions().length;
        });

        this[typeBounceSym] = debounce(() => {
            return autocomplete({
                query: this.filter(),
                path: (this.filterType() || {}).path
            });
        }, CONST.searchDebounceMs);
    }

    select() {
    }

    clear() {
        this.suggestions([]);
        this.alertMessage(false);
    }

    type() {
        this.alertMessage('searching for ' + this.filter() + '...');
        this[typeBounceSym]().then(res => {
            this.alertMessage(false);
            this.ingore(res);
            // if (res) {

            // } else {

            // }
        })
        .catch(ex => {
            this.alertMessage(ex.message);
        })
        .then(this.emit('update'));
    }
}

export default AutoComplete;
