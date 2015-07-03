import $ from 'jquery';
import autocomplete from 'modules/auto-complete';
import * as mockjax from 'test/utils/mockjax';
import * as cache from 'modules/cache';
import {CONST} from 'modules/vars';
import inject from 'test/utils/inject';
import * as wait from 'test/utils/wait';

describe('Autocomplete', function () {
    beforeEach(function () {
        this.originalsearchDebounceMs = CONST.searchDebounceMs;
        CONST.searchDebounceMs = 50;
        this.scope = mockjax.scope();
    });
    afterEach(function () {
        CONST.searchDebounceMs = this.originalsearchDebounceMs;
        this.scope.clear();
    });

    describe('API', function () {
        it('ignores empty strings', function (done) {
            autocomplete({}).then(res => {
                expect(res).toBeUndefined();
                done();
            }, done.fail);
        });

        it('rejects invalid characters', function (done) {
            autocomplete({
                query: '!@£$%^&*('
            }).then(done.fail, done);
        });

        it('rejects malformed response', function (done) {
            this.scope({
                url: CONST.apiSearchBase + '/fruit?q=banana*',
                responseText: {
                    nothing: 'here'
                }
            });

            autocomplete({
                query: 'banana',
                path: 'fruit'
            }).then(done.fail, done);
        });

        it('handles missing results', function (done) {
            this.scope({
                url: CONST.apiSearchBase + '/fruit?q=apple*',
                responseText: {
                    response: { results: [] }
                }
            });

            autocomplete({
                query: 'apple',
                path: 'fruit'
            }).then(res => {
                expect(cache.get('contentApi', '/fruit?q=apple&page-size=50&page=1')).toEqual({
                    results: []
                });
                expect(res).toEqual({
                    results: []
                });
                done();
            })
            .catch(done.fail);
        });

        it('returns expected results', function (done) {
            this.scope({
                url: CONST.apiSearchBase + '/fruit?q=kiwi*',
                responseText: {
                    response: { results: ['one', 'two', 'three'] }
                }
            });

            autocomplete({
                query: 'kiwi',
                path: 'fruit'
            }).then(res => {
                expect(cache.get('contentApi', '/fruit?q=kiwi&page-size=50&page=1')).toEqual({
                    results: ['one', 'two', 'three']
                });
                expect(res).toEqual({
                    results: ['one', 'two', 'three']
                });
                done();
            })
            .catch(done.fail);
        });

        it('uses the cache', function (done) {
            var counter = 0;
            this.scope({
                url: CONST.apiSearchBase + '/fruit?q=mango*',
                responseText: {
                    response: { results: ['a'] }
                },
                onAfterComplete: function () {
                    counter += 1;
                }
            });

            autocomplete({
                query: 'mango',
                path: 'fruit'
            }).then(res => {
                expect(cache.get('contentApi', '/fruit?q=mango&page-size=50&page=1')).toEqual({
                    results: ['a']
                });
                expect(res).toEqual({
                    results: ['a']
                });
                expect(counter).toBe(1);

                autocomplete({
                    query: 'mango',
                    path: 'fruit'
                }).then(fromCache => {
                    expect(cache.get('contentApi', '/fruit?q=mango&page-size=50&page=1')).toEqual({
                        results: ['a']
                    });
                    expect(fromCache).toEqual({
                        results: ['a']
                    });
                    expect(counter).toBe(1);
                    done();
                });
            })
            .catch(done.fail);
        });
    });

    fdescribe('Widget', function () {
        beforeEach(function () {
            this.ko = inject(`
                <autocomplete></autocomplete>
            `);
        });
        afterEach(function () {
            // this.ko.dispose();
        });

        it('searches debouncing', function (done) {
            var counter = 0, widget;
            this.scope({
                url: CONST.apiSearchBase + '/sections?q=*',
                response: function (req) {
                    counter += 1;
                    console.log(req);
                    this.responseText = {
                        response: {
                            results: [{ id: 'one' }, {id: 'two' }]
                        }
                    };
                }
            });
            this.ko.apply({})
            .then(() => wait.event('widget:load'))
            .then((autocompleteWidget) => {
                widget = autocompleteWidget;
                $('.search--filter').val('n').change();
            })
            .then(() => {
                $('.search--filter').val('ne').change();
            })
            .then(() => {
                $('.search--filter').val('new').change();
            })
            .then(() => {
                $('.search--filter').val('news').change();
            })
            .then(() => wait.event('update', widget))
            .then(() => {
                expect(counter).toBe(1);
            })
            .then(done);
        });
    });
});
