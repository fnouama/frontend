define([
    'qwery',
    'common/utils/$',
    'common/utils/config',
    'common/utils/template',
    'text!common/views/commercial/creatives/branded-component-jobs.html',
    'text!common/views/commercial/creatives/branded-component-membership.html',
    'text!common/views/commercial/creatives/branded-component-soulmates.html'
], function (
    qwery,
    $,
    config,
    template,
    brandedComponentJobsTpl,
    brandedComponentMembershipTpl,
    brandedComponentSoulmatesTpl
) {

    var templates = {
        jobs: {
            template: brandedComponentJobsTpl,
            config:   {
                imgUrl: config.images.commercial.brandedComponentJobs
            }
        },
        membership: {
            template: brandedComponentMembershipTpl,
            config:   {
                imgUrl: config.images.commercial.brandedComponentJobs
            }
        },
        soulmates: {
            template: brandedComponentSoulmatesTpl,
            config:   {}
        }
    };

    return {

        run: function (type) {
            var templateConfig = templates[type],
                $rightHandCol  = $('.content__secondary-column');

            if (!templateConfig || $rightHandCol.css('display') === 'none') {
                return false;
            }

            $.create(template(templateConfig.template, templateConfig.config))
                .appendTo($rightHandCol);

            // assumption - this will always be targeted to the 88x87 slot
            $('#dfp-ad--merchandising-high').css('display', 'none');
        }

    };

});