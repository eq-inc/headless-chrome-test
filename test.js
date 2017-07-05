/* vim: set expandtab tabstop=4 shiftwidth=4 softtabstop=4: */
/* eslint-env es6, mocha, node */
/* eslint-extends: eslint:recommended */
'use strict';


const fs = require('fs');
const cheerio = require('cheerio');
const CDP = require('chrome-remote-interface');
const expect = require('expect.js');


/**
 * Get node ID by selector
 *
 * @param {Object} client
 * @param {string} selector
 * @param {null|number|undefined} nodeId
 */
const querySelector = async (client, selector, nodeId) => {
    const result = await client.DOM.querySelector({
        nodeId: nodeId || 1,
        selector: selector
    });

    return result.nodeId;
};

/**
 * Get all node ID by selector
 *
 * @param {Object} client
 * @param {string} selector
 * @param {null|number|undefined} nodeId
 */
const querySelectorAll = async (client, selector, nodeId) => {
    const result = await client.DOM.querySelectorAll({
        nodeId: nodeId || 1,
        selector: selector
    });

    return result.nodeIds;
};

/**
 * Send key event
 *
 * @param {Object} client
 * @param {Object|number} nodeId
 * @param {string} text
 * @param {Object|undefined} options
 */
const sendKeys = async (client, nodeId, text, options) => {
    nodeId = (nodeId instanceof Object) ? nodeId : {nodeId: nodeId};
    const parameters = Object.assign({}, options);
    await client.DOM.focus(nodeId);

    return text.split('').reduce(async function (collection, value) {
        return collection.then(function () {
            parameters.type = 'keyDown';
            parameters.text = value;

            return client.Input.dispatchKeyEvent(parameters);
        }).then(function () {
            parameters.type = 'keyUp';

            return client.Input.dispatchKeyEvent(parameters);
        });
    }, Promise.resolve());
};

/**
 * Send click event
 *
 * @param {Object} client
 * @param {Object|number} nodeId
 * @param {Object} options
 */
const click = async (client, nodeId, options) => {
    nodeId = (nodeId instanceof Object) ? nodeId : {nodeId: nodeId};
    const boxmodel = await client.DOM.getBoxModel(nodeId),
        content = boxmodel.model.content,
        parameters = Object.assign({
            x: content[0] + Math.floor((content[2] - content[0]) / 2),
            y: content[1] + Math.floor((content[5] - content[1]) / 2),
            button: 'left',
            clickCount: 1
        }, options);

    parameters.type = 'mousePressed';
    await client.Input.dispatchMouseEvent(parameters);
    parameters.type = 'mouseReleased';

    return client.Input.dispatchMouseEvent(parameters);
};

describe('Headless chrome test', function () {
    describe('Protoractor test sample', function () {
        it('Should complete test', function (done) {
            (async () => {
                const client = await CDP(),
                    text = 'write first protractor test';
                await Promise.all([
                    client.Page.enable(),
                    client.DOM.enable(),
                ]);

                client.once('Page.loadEventFired', (async () => {
                    const document = await client.DOM.getDocument(),
                        todo = await querySelector(client, 'div[app-run="todo.html"]', document.root.nodeId),
                        field = await querySelector(client, 'input[type="text"]', todo),
                        button = await querySelector(client, 'input[value="add"]', todo);
                    await sendKeys(client, field, text);
                    await click(client, button);

                    const items = await querySelectorAll(client, 'li[ng-repeat="todo in todoList.todos"]', todo);
                    expect(items).to.have.length(3);

                    const content = await client.DOM.getOuterHTML({nodeId: items[2]}),
                        element = cheerio.load(content.outerHTML);
                    expect(element('span').text()).to.be(text);

                    const item = await querySelector(client, 'input', items[2]);
                    await click(client, item);

                    const completed = await querySelectorAll(client, '.done-true');
                    expect(completed).to.have.length(2);

                    client.close();

                    done();
                }));

                client.Page.navigate({url: 'https://angularjs.org/'});
            })();
        });
    });
});



/*
 * Local variables:
 * tab-width: 4
 * c-basic-offset: 4
 * c-hanging-comment-ender-p: nil
 * End:
 */

