// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import 'reflect-metadata';

import { Page, CDPSession, Target } from 'puppeteer';
import { IMock, Mock } from 'typemoq';
import { PageConfigurator } from './page-configurator';
import { getPromisableDynamicMock } from './test-utilities/promisable-mock';

describe(PageConfigurator, () => {
    let pageConfigurator: PageConfigurator;
    let pageMock: IMock<Page>;
    let cdpSessionMock: IMock<CDPSession>;
    let targetMock: IMock<Target>;

    beforeEach(() => {
        pageMock = Mock.ofType<Page>();
        targetMock = Mock.ofType<Target>();
        cdpSessionMock = getPromisableDynamicMock(Mock.ofType<CDPSession>());

        cdpSessionMock
            .setup((o) => o.send('Emulation.clearDeviceMetricsOverride'))
            .returns(() => Promise.resolve())
            .verifiable();
        targetMock
            .setup((o) => o.createCDPSession())
            .returns(() => Promise.resolve(cdpSessionMock.object))
            .verifiable();
        pageMock
            .setup((o) => o.target())
            .returns(() => targetMock.object)
            .verifiable();
        pageMock
            .setup(async (o) => o.setBypassCSP(true))
            .returns(() => Promise.resolve())
            .verifiable();

        pageConfigurator = new PageConfigurator();
    });

    afterEach(() => {
        pageMock.verifyAll();
        targetMock.verifyAll();
        cdpSessionMock.verifyAll();
    });

    it('configurePage()', async () => {
        await pageConfigurator.configurePage(pageMock.object);
    });
});
