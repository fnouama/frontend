import Promise from 'Promise';
import $ from 'common/utils/$';
import template from 'common/utils/template';
import fixtures from 'helpers/fixtures';
import Injector from 'helpers/injector';
import richLinkTagTmpl from 'text!common/views/content/richLinkTag.html';

describe('richLinks', function () {
    var articleBodyConf = {
        id: 'article-body',
        fixtures: [
            // Minimal article body fixture
            '<div class="js-article__body"><p>foo</p></div>'
        ]
    };

    var getRichLinkElements = function () {
        return $('#article-body .element-rich-link');
    };

    var articleBodyFixtureElement,
        richLinks, config, spacefinder,
        injector = new Injector();

    beforeEach(function (done) {
        articleBodyFixtureElement = fixtures.render(articleBodyConf);

        injector.test(['common/modules/article/rich-links', 'common/utils/config', 'common/modules/article/spacefinder'], function () {
            richLinks = arguments[0];
            config = arguments[1];
            spacefinder = arguments[2];

            spacefinder.getParaWithSpace = function () {
                return Promise.resolve($('#article-body p').first());
            };

            done();
        });
    });

    afterEach(function () {
        fixtures.clean(articleBodyConf.id);
    });

    describe('#insertTagRichLink', function () {
        describe('given no tag rich link', function () {
            it('should not insert a tag rich link', function (done) {
                richLinks.insertTagRichLink().then(function () {
                    var richLinkElements = getRichLinkElements();
                    expect(richLinkElements.length).toBe(0);
                    done();
                });
            });
        });

        describe('given a tag rich link', function () {
            // Mock a tag rich link
            beforeEach(function () {
                config.page = {
                    richLink: 'foo',
                    // Content API defaults
                    shouldHideAdverts: false,
                    showRelatedContent: true
                };
            });

            afterEach(function () {
                delete config.page.richLink;
            });

            it('should insert the provided tag rich link', function (done) {
                richLinks.insertTagRichLink().then(function () {
                    var richLinkElements = getRichLinkElements();
                    expect(richLinkElements.length).toBe(1);
                    expect(richLinkElements[0].outerHTML)
                        .toBe(template(richLinkTagTmpl, { href: config.page.richLink }).trim());

                    done();
                });
            });

            describe('given `config.page.shouldHideAdverts` is set to `true`', function () {
                beforeEach(function () {
                    config.page.shouldHideAdverts = true;
                });

                afterEach(function () {
                    delete config.page.shouldHideAdverts;
                });

                it('should not insert the provided tag rich link', function () {
                    richLinks.insertTagRichLink();

                    var richLinkElements = getRichLinkElements();
                    expect(richLinkElements.length).toBe(0);
                });
            });

            describe('given `config.page.showRelatedContent` is set to `false`', function () {
                beforeEach(function () {
                    config.page.showRelatedContent = false;
                });

                afterEach(function () {
                    delete config.page.showRelatedContent;
                });

                it('should not insert the provided tag rich link', function () {
                    richLinks.insertTagRichLink();

                    var richLinkElements = getRichLinkElements();
                    expect(richLinkElements.length).toBe(0);
                });
            });

            describe('given an existing rich link with the same URL', function () {
                // No need to clean because the parent element is reset after each
                beforeEach(function () {
                    var existingRichLinkElement = $.create(template(richLinkTagTmpl, { href: config.page.richLink }));

                    articleBodyFixtureElement.append(existingRichLinkElement);
                });

                it('should not insert the provided tag rich link', function () {
                    richLinks.insertTagRichLink();

                    var richLinkElements = getRichLinkElements();
                    expect(richLinkElements.length).toBe(1);
                });
            });
        });
    });
});
