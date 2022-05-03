// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import 'reflect-metadata';

import { GuidGenerator } from 'common';
import { IMock, Mock } from 'typemoq';
import * as mockDate from 'mockdate';
import { PrivacyScanResult } from 'scanner-global-library';
import { FailedUrl, PrivacyPageScanReport, PrivacyScanCombinedReport, PrivacyScanStatus } from 'storage-documents';
import _ from 'lodash';
import { PrivacyReportMetadata, PrivacyReportReducer } from './privacy-report-reducer';

describe(PrivacyReportReducer, () => {
    const metadata: PrivacyReportMetadata = {
        scanId: 'scan id',
        websiteScanId: 'website scan id',
        url: 'url',
    };
    const startDate = new Date(1, 2, 3, 4);
    const currentDate = new Date(5, 6, 7, 8);
    const successfulScanResult: PrivacyScanResult = {
        pageResponseCode: 200,
        results: {
            httpStatusCode: 200,
            finishDateTime: currentDate,
            navigationalUri: 'navigational url',
            seedUri: 'seed url',
            cookieCollectionConsentResults: [
                {
                    cookiesUsedForConsent: 'cookie1=value',
                    cookiesBeforeConsent: [
                        {
                            domain: 'domain1',
                            cookies: [{ name: 'domain1cookie1', domain: 'domain1' }],
                        },
                    ],
                    cookiesAfterConsent: [
                        {
                            domain: 'domain1',
                            cookies: [
                                { name: 'domain1cookie1', domain: 'domain1' },
                                { name: 'domain1cookie2', domain: 'domain1' },
                            ],
                        },
                        {
                            domain: 'domain2',
                            cookies: [{ name: 'domain2cookie1', domain: 'domain2' }],
                        },
                    ],
                },
                {
                    cookiesUsedForConsent: 'cookie2=value',
                    cookiesBeforeConsent: [],
                    cookiesAfterConsent: [
                        {
                            domain: 'domain2',
                            cookies: [{ name: 'domain2cookie1', domain: 'domain2' }],
                        },
                        {
                            domain: 'domain2',
                            cookies: [{ name: 'domain2cookie2', domain: 'domain2' }],
                        },
                    ],
                },
            ],
            bannerDetected: true,
            bannerDetectionXpathExpression: 'banner xpath',
        },
    };
    const partialScanResult: PrivacyScanResult = {
        pageResponseCode: 200,
        error: 'Page reload error',
        results: {
            ..._.cloneDeep(successfulScanResult.results),
            cookieCollectionConsentResults: [
                ..._.cloneDeep(successfulScanResult.results.cookieCollectionConsentResults),
                {
                    cookiesUsedForConsent: 'cookie3=value',
                    error: 'First page reload failed',
                },
                {
                    cookiesUsedForConsent: 'cookie4=value',
                    error: 'Second page reload failed',
                    cookiesBeforeConsent: [
                        {
                            domain: 'domain3',
                            cookies: [{ name: 'domain3cookie1', domain: 'domain3' }],
                        },
                    ],
                },
            ],
        },
    };
    let guidGeneratorMock: IMock<GuidGenerator>;

    let testSubject: PrivacyReportReducer;

    beforeEach(() => {
        mockDate.set(currentDate);
        guidGeneratorMock = Mock.ofType<GuidGenerator>();
        guidGeneratorMock.setup((gg) => gg.getGuidTimestamp(metadata.scanId)).returns(() => startDate);

        testSubject = new PrivacyReportReducer(guidGeneratorMock.object);
    });

    afterEach(() => {
        mockDate.reset();
    });

    describe('Creates new combined report if none is provided', () => {
        it('with successful scan result', () => {
            const expectedReport: PrivacyScanCombinedReport = {
                scanId: metadata.websiteScanId,
                status: 'Completed',
                urls: [metadata.url],
                failedUrls: [],
                scanCookies: [
                    { name: 'domain1cookie1', domain: 'domain1' },
                    { name: 'domain1cookie2', domain: 'domain1' },
                    { name: 'domain2cookie1', domain: 'domain2' },
                    { name: 'domain2cookie2', domain: 'domain2' },
                ],
                cookieCollectionUrlResults: [successfulScanResult.results],
                startDateTime: startDate,
                finishDateTime: currentDate,
            };

            const actualReport = testSubject.reduceResults(successfulScanResult, undefined, metadata);

            expect(actualReport).toEqual(expectedReport);
        });

        it('with failed partial scan result', () => {
            const failedUrl: FailedUrl = {
                url: partialScanResult.results.navigationalUri,
                seedUri: partialScanResult.results.seedUri,
                httpStatusCode: partialScanResult.pageResponseCode,
                reason: 'error="Page reload error"',
                bannerDetected: partialScanResult.results.bannerDetected,
                bannerDetectionXpathExpression: partialScanResult.results.bannerDetectionXpathExpression,
            };

            const expectedReport: PrivacyScanCombinedReport = {
                scanId: metadata.websiteScanId,
                status: 'Failed',
                urls: [metadata.url],
                failedUrls: [failedUrl],
                scanCookies: [
                    { name: 'domain1cookie1', domain: 'domain1' },
                    { name: 'domain1cookie2', domain: 'domain1' },
                    { name: 'domain2cookie1', domain: 'domain2' },
                    { name: 'domain2cookie2', domain: 'domain2' },
                    { name: 'domain3cookie1', domain: 'domain3' },
                ],
                cookieCollectionUrlResults: [partialScanResult.results],
                startDateTime: startDate,
                finishDateTime: currentDate,
            };

            const actualReport = testSubject.reduceResults(partialScanResult, undefined, metadata);

            expect(actualReport).toEqual(expectedReport);
        });

        it('with failed scan and no scan results', () => {
            const failedScanResult: PrivacyScanResult = {
                error: 'Browser error',
                pageResponseCode: 404,
            };
            const failedUrl: FailedUrl = {
                url: metadata.url,
                seedUri: metadata.url,
                httpStatusCode: 404,
                reason: 'error="Browser error"',
                bannerDetected: undefined,
                bannerDetectionXpathExpression: undefined,
            };

            const expectedReport: PrivacyScanCombinedReport = {
                scanId: metadata.websiteScanId,
                status: 'Failed',
                urls: [metadata.url],
                failedUrls: [failedUrl],
                scanCookies: [],
                cookieCollectionUrlResults: [],
                startDateTime: startDate,
                finishDateTime: currentDate,
            };

            const actualReport = testSubject.reduceResults(failedScanResult, undefined, metadata);

            expect(actualReport).toEqual(expectedReport);
        });
    });

    describe('Combines with existing report', () => {
        let existingReport: PrivacyScanCombinedReport;

        beforeEach(() => {
            existingReport = {
                scanId: 'report scan id',
                status: 'Completed',
                urls: ['url1', 'url2'],
                failedUrls: [],
                scanCookies: [
                    { name: 'domain1cookie1', domain: 'domain1' },
                    { name: 'domain2cookie1', domain: 'domain2' },
                    { name: 'domain4cookie1', domain: 'domain4' },
                ],
                cookieCollectionUrlResults: [
                    {
                        httpStatusCode: 200,
                    } as PrivacyPageScanReport,
                ],
                startDateTime: new Date(0, 0, 0, 0),
                finishDateTime: new Date(1, 1, 1, 1),
            };
        });

        it.each(['Completed', 'Failed'] as PrivacyScanStatus[])('with successful scan result and existing report status=%s', (status) => {
            existingReport.status = status;

            const expectedReport: PrivacyScanCombinedReport = {
                ..._.cloneDeep(existingReport),
                status: status,
                urls: [...existingReport.urls, metadata.url],
                scanCookies: [
                    ...existingReport.scanCookies,
                    { name: 'domain1cookie2', domain: 'domain1' },
                    { name: 'domain2cookie2', domain: 'domain2' },
                ],
                cookieCollectionUrlResults: [...existingReport.cookieCollectionUrlResults, successfulScanResult.results],
                finishDateTime: currentDate,
            };

            const actualReport = testSubject.reduceResults(successfulScanResult, existingReport, metadata);

            expect(actualReport).toEqual(expectedReport);
        });

        it.each(['Completed', 'Failed'] as PrivacyScanStatus[])(
            'with failed partial scan result and existing report status=%s',
            (status) => {
                existingReport.status = status;

                const failedUrl: FailedUrl = {
                    url: partialScanResult.results.navigationalUri,
                    seedUri: partialScanResult.results.seedUri,
                    httpStatusCode: partialScanResult.pageResponseCode,
                    reason: 'error="Page reload error"',
                    bannerDetected: partialScanResult.results.bannerDetected,
                    bannerDetectionXpathExpression: partialScanResult.results.bannerDetectionXpathExpression,
                };
                const expectedReport: PrivacyScanCombinedReport = {
                    ..._.cloneDeep(existingReport),
                    status: 'Failed',
                    urls: [...existingReport.urls, metadata.url],
                    scanCookies: [
                        ...existingReport.scanCookies,
                        { name: 'domain1cookie2', domain: 'domain1' },
                        { name: 'domain2cookie2', domain: 'domain2' },
                        { name: 'domain3cookie1', domain: 'domain3' },
                    ],
                    cookieCollectionUrlResults: [...existingReport.cookieCollectionUrlResults, partialScanResult.results],
                    failedUrls: [failedUrl],
                    finishDateTime: currentDate,
                };

                const actualReport = testSubject.reduceResults(partialScanResult, existingReport, metadata);

                expect(actualReport).toEqual(expectedReport);
            },
        );

        it.each(['Completed', 'Failed'] as PrivacyScanStatus[])(
            'with failed scan, no scan results, and existing report status=%s',
            (status) => {
                existingReport.status = status;

                const failedScanResult: PrivacyScanResult = {
                    error: 'Browser error',
                    pageResponseCode: 404,
                };
                const failedUrl: FailedUrl = {
                    url: metadata.url,
                    seedUri: metadata.url,
                    httpStatusCode: 404,
                    reason: 'error="Browser error"',
                };

                const expectedReport: PrivacyScanCombinedReport = {
                    ..._.cloneDeep(existingReport),
                    status: 'Failed',
                    urls: [...existingReport.urls, metadata.url],
                    failedUrls: [failedUrl],
                    finishDateTime: currentDate,
                };

                const actualReport = testSubject.reduceResults(failedScanResult, existingReport, metadata);

                expect(actualReport).toEqual(expectedReport);
            },
        );

        it.each([metadata.url, successfulScanResult.results.navigationalUri])(
            'Replace existing failed results for failed url="%s" if retried scan succeeded',
            (url) => {
                const expectedReport: PrivacyScanCombinedReport = {
                    ..._.cloneDeep(existingReport),
                    urls: [...existingReport.urls, metadata.url],
                    status: 'Completed',
                    scanCookies: [
                        ...existingReport.scanCookies,
                        { name: 'domain1cookie2', domain: 'domain1' },
                        { name: 'domain2cookie2', domain: 'domain2' },
                    ],
                    cookieCollectionUrlResults: [...existingReport.cookieCollectionUrlResults, successfulScanResult.results],
                    failedUrls: [],
                    finishDateTime: currentDate,
                };

                existingReport.urls.push(metadata.url);
                existingReport.failedUrls.push({
                    url: url,
                } as FailedUrl);
                existingReport.cookieCollectionUrlResults.push({
                    navigationalUri: successfulScanResult.results.navigationalUri,
                    cookieCollectionConsentResults: [{ error: 'browser error' }],
                } as PrivacyPageScanReport);
                existingReport.status = 'Failed';

                const actualReport = testSubject.reduceResults(successfulScanResult, existingReport, metadata);

                expect(actualReport).toEqual(expectedReport);
            },
        );

        it('Replace existing failed results if retried scan also failed', () => {
            existingReport.urls.push(metadata.url);
            existingReport.failedUrls.push({
                url: metadata.url,
            } as FailedUrl);

            const failedScanResult: PrivacyScanResult = {
                error: 'Browser error',
                pageResponseCode: 404,
            };
            const failedUrl: FailedUrl = {
                url: metadata.url,
                seedUri: metadata.url,
                httpStatusCode: 404,
                reason: 'error="Browser error"',
            };

            const expectedReport: PrivacyScanCombinedReport = {
                ..._.cloneDeep(existingReport),
                status: 'Failed',
                failedUrls: [failedUrl],
                finishDateTime: currentDate,
            };

            const actualReport = testSubject.reduceResults(failedScanResult, existingReport, metadata);

            expect(actualReport).toEqual(expectedReport);
        });

        it('Replace existing failed results if retried scan succeeded but other scans have failed', () => {
            const existingFailedUrl = { url: 'some other url' } as FailedUrl;

            const expectedReport: PrivacyScanCombinedReport = {
                ..._.cloneDeep(existingReport),
                urls: [...existingReport.urls, metadata.url],
                status: 'Failed',
                scanCookies: [
                    ...existingReport.scanCookies,
                    { name: 'domain1cookie2', domain: 'domain1' },
                    { name: 'domain2cookie2', domain: 'domain2' },
                ],
                cookieCollectionUrlResults: [...existingReport.cookieCollectionUrlResults, successfulScanResult.results],
                failedUrls: [existingFailedUrl],
                finishDateTime: currentDate,
            };

            existingReport.urls.push(metadata.url);
            existingReport.failedUrls = [{ url: metadata.url }, existingFailedUrl] as FailedUrl[];
            existingReport.cookieCollectionUrlResults.push({
                navigationalUri: successfulScanResult.results.navigationalUri,
                cookieCollectionConsentResults: [{ error: 'browser error' }],
            } as PrivacyPageScanReport);
            existingReport.status = 'Failed';

            const actualReport = testSubject.reduceResults(successfulScanResult, existingReport, metadata);

            expect(actualReport).toEqual(expectedReport);
        });
    });
});