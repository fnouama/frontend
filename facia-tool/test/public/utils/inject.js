import ko from 'knockout';
import Promise from 'Promise';
import {register} from 'models/widgets';

export default function (html) {
    register();
    const DOM_ID = 'test_dom_' + Math.round(Math.random() * 10000);

    document.body.innerHTML += `
        <div id="${DOM_ID}">
            ${html}
        </div>
    `;

    let container = document.getElementById(DOM_ID);
    return {
        container,
        apply: (model) => {
            return new Promise(resolve => {
                ko.applyBindings(model, container);
                setTimeout(resolve, 10);
            });
        },
        dispose: () => {
            ko.cleanNode(container);
            container.parentNode.removeChild(container);
        }
    };
}
