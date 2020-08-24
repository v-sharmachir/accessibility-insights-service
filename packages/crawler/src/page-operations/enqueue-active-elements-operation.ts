// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import Apify from 'apify';
import { Page } from 'puppeteer';
import { ActiveElementsFinder } from '../utility/active-elements-finder';
import { Operation } from './operation';

// tslint:disable: no-var-requires no-submodule-imports no-require-imports no-unsafe-any
const apifyUtilities = require('apify-shared/utilities');

export class EnqueueActiveElementsOperation {
    constructor(private readonly activeElementFinder: ActiveElementsFinder = new ActiveElementsFinder()) {}

    public async find(page: Page, selectors: string[], requestQueue: Apify.RequestQueue): Promise<void> {
        const url = page.url();
        const elements = await this.activeElementFinder.getActiveElements(page, selectors);
        await Promise.all(
            elements.map(async (e) => {
                const uniqueKey = `${apifyUtilities.normalizeUrl(url, false)}#${e.hash}`;
                const userData: Operation = {
                    operationType: 'click',
                    data: e,
                };
                await requestQueue.addRequest({ url, uniqueKey, userData });
            }),
        );

        if (elements.length > 0) {
            console.log(`Discovered ${elements.length} active elements on page ${url}`);
        }
    }
}