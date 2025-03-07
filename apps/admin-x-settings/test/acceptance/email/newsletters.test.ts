import {chooseOptionInSelect, globalDataRequests, limitRequests, mockApi, responseFixtures} from '../../utils/acceptance';
import {expect, test} from '@playwright/test';

test.describe('Newsletter settings', async () => {
    test('Supports creating a new newsletter', async ({page}) => {
        const {lastApiRequests} = await mockApi({page, requests: {
            ...globalDataRequests,
            browseNewsletters: {method: 'GET', path: '/newsletters/?include=count.active_members%2Ccount.posts&limit=50', response: responseFixtures.newsletters},
            addNewsletter: {method: 'POST', path: '/newsletters/?opt_in_existing=true&include=count.active_members%2Ccount.posts', response: {newsletters: [{
                id: 'new-newsletter',
                name: 'New newsletter',
                description: null,
                count: {
                    active_members: 0,
                    posts: 0
                }
            }]}}
        }});

        await page.goto('/');

        const section = page.getByTestId('newsletters');

        await section.getByRole('button', {name: 'Add newsletter'}).click();

        const modal = page.getByTestId('add-newsletter-modal');
        await modal.getByRole('button', {name: 'Create'}).click();

        await expect(page.getByTestId('toast-error')).toHaveText(/Can't save newsletter/);
        await expect(modal).toHaveText(/Please enter a name/);

        // Shouldn't be necessary, but without these Playwright doesn't click Create the second time for some reason
        await modal.getByRole('button', {name: 'Cancel'}).click();
        await section.getByRole('button', {name: 'Add newsletter'}).click();

        await modal.getByLabel('Name').fill('New newsletter');
        await modal.getByRole('button', {name: 'Create'}).click();

        await expect(page.getByTestId('newsletter-modal')).toHaveCount(1);

        expect(lastApiRequests.addNewsletter?.body).toMatchObject({
            newsletters: [{
                name: 'New newsletter'
            }]
        });
    });

    test('Supports updating a newsletter', async ({page}) => {
        const {lastApiRequests} = await mockApi({page, requests: {
            ...globalDataRequests,
            browseNewsletters: {method: 'GET', path: '/newsletters/?include=count.active_members%2Ccount.posts&limit=50', response: responseFixtures.newsletters},
            editNewsletter: {method: 'PUT', path: `/newsletters/${responseFixtures.newsletters.newsletters[0].id}/?include=count.active_members%2Ccount.posts`, response: {
                newsletters: [{
                    ...responseFixtures.newsletters.newsletters[0],
                    name: 'Updated newsletter',
                    body_font_category: 'sans_serif'
                }]
            }}
        }});

        await page.goto('/');

        const section = page.getByTestId('newsletters');

        await section.getByText('Awesome newsletter').click();

        const modal = page.getByTestId('newsletter-modal');

        await modal.getByPlaceholder('Weekly Roundup').fill('');
        await modal.getByRole('button', {name: 'Save'}).click();

        await expect(page.getByTestId('toast-error')).toHaveText(/Can't save newsletter/);
        await expect(modal).toHaveText(/Please enter a name/);

        await modal.getByPlaceholder('Weekly Roundup').fill('Updated newsletter');

        await modal.getByRole('tab', {name: 'Design'}).click();
        await chooseOptionInSelect(modal.getByTestId('body-font-select'), 'Clean sans-serif');

        await modal.getByRole('button', {name: 'Save'}).click();

        await expect(section.getByText('Updated newsletter')).toHaveCount(1);

        expect(lastApiRequests.editNewsletter?.body).toMatchObject({
            newsletters: [{
                id: responseFixtures.newsletters.newsletters[0].id,
                name: 'Updated newsletter',
                body_font_category: 'sans_serif'
            }]
        });
    });

    test('Displays a prompt when email verification is required', async ({page}) => {
        await mockApi({page, requests: {
            ...globalDataRequests,
            browseNewsletters: {method: 'GET', path: '/newsletters/?include=count.active_members%2Ccount.posts&limit=50', response: responseFixtures.newsletters},
            editNewsletter: {method: 'PUT', path: `/newsletters/${responseFixtures.newsletters.newsletters[0].id}/?include=count.active_members%2Ccount.posts`, response: {
                newsletters: [responseFixtures.newsletters.newsletters[0]],
                meta: {
                    sent_email_verification: ['sender_email']
                }
            }}
        }});

        await page.goto('/');

        const section = page.getByTestId('newsletters');

        await section.getByText('Awesome newsletter').click();

        const modal = page.getByTestId('newsletter-modal');

        await modal.getByLabel('Sender email').fill('test@test.com');
        await modal.getByRole('button', {name: 'Save'}).click();

        await expect(page.getByTestId('confirmation-modal')).toHaveCount(1);
        await expect(page.getByTestId('confirmation-modal')).toHaveText(/Confirm newsletter email address/);
    });

    test('Supports archiving newsletters', async ({page}) => {
        const activate = await mockApi({page, requests: {
            ...globalDataRequests,
            browseNewsletters: {method: 'GET', path: '/newsletters/?include=count.active_members%2Ccount.posts&limit=50', response: responseFixtures.newsletters},
            editNewsletter: {method: 'PUT', path: `/newsletters/${responseFixtures.newsletters.newsletters[1].id}/?include=count.active_members%2Ccount.posts`, response: {
                newsletters: [{
                    ...responseFixtures.newsletters.newsletters[1],
                    status: 'active'
                }]
            }}
        }});

        await page.goto('/');

        const section = page.getByTestId('newsletters');

        await section.getByRole('tab', {name: 'Archived'}).click();

        await section.getByText('Average newsletter').hover();
        await section.getByRole('button', {name: 'Edit'}).click();

        const archivedNewsletterModal = page.getByTestId('newsletter-modal');
        await archivedNewsletterModal.getByRole('button', {name: 'Reactivate newsletter'}).click();
        await page.getByTestId('confirmation-modal').getByRole('button', {name: 'Reactivate'}).click();
        await archivedNewsletterModal.getByRole('button', {name: 'Close'}).click();

        await section.getByRole('tab', {name: 'Active'}).click();

        await expect(section.getByText('Awesome newsletter')).toHaveCount(1);
        await expect(section.getByText('Average newsletter')).toHaveCount(1);

        expect(activate.lastApiRequests.editNewsletter?.body).toMatchObject({
            newsletters: [{
                id: responseFixtures.newsletters.newsletters[1].id,
                status: 'active'
            }]
        });

        const archive = await mockApi({page, requests: {
            ...globalDataRequests,
            browseNewsletters: {method: 'GET', path: '/newsletters/?include=count.active_members%2Ccount.posts&limit=50', response: responseFixtures.newsletters},
            editNewsletter: {method: 'PUT', path: `/newsletters/${responseFixtures.newsletters.newsletters[0].id}/?include=count.active_members%2Ccount.posts`, response: {
                newsletters: [{
                    ...responseFixtures.newsletters.newsletters[0],
                    status: 'archived'
                }]
            }}
        }});

        await section.getByText('Awesome newsletter').hover();
        await section.getByRole('button', {name: 'Edit'}).click();

        const activeNewsletterModal = page.getByTestId('newsletter-modal');
        await activeNewsletterModal.getByRole('button', {name: 'Archive newsletter'}).click();
        await page.getByTestId('confirmation-modal').getByRole('button', {name: 'Archive'}).click();
        await activeNewsletterModal.getByRole('button', {name: 'Close'}).click();

        await section.getByRole('tab', {name: 'Archived'}).click();

        await expect(section.getByText('Awesome newsletter')).toHaveCount(1);

        expect(archive.lastApiRequests.editNewsletter?.body).toMatchObject({
            newsletters: [{
                id: responseFixtures.newsletters.newsletters[0].id,
                status: 'archived'
            }]
        });
    });

    test('Limits the number of newsletters', async ({page}) => {
        await mockApi({page, requests: {
            ...globalDataRequests,
            ...limitRequests,
            browseConfig: {
                ...globalDataRequests.browseConfig,
                response: {
                    config: {
                        ...responseFixtures.config.config,
                        hostSettings: {
                            limits: {
                                newsletters: {
                                    max: 1,
                                    error: 'Your plan supports up to {{max}} newsletters. Please upgrade to add more.'
                                }
                            }
                        }
                    }
                }
            },
            browseNewsletters: {method: 'GET', path: '/newsletters/?include=count.active_members%2Ccount.posts&limit=50', response: responseFixtures.newsletters}
        }});

        await page.goto('/');

        const section = page.getByTestId('newsletters');

        await section.getByRole('button', {name: 'Add newsletter'}).click();

        await expect(page.getByTestId('limit-modal')).toHaveText(/Your plan supports up to 1 newsletters/);

        await page.getByTestId('limit-modal').getByRole('button', {name: 'Cancel'}).click();

        await section.getByRole('tab', {name: 'Archived'}).click();

        await section.getByText('Average newsletter').hover();
        await section.getByRole('button', {name: 'Edit'}).click();

        const newsletterModal = page.getByTestId('newsletter-modal');
        await newsletterModal.getByRole('button', {name: 'Reactivate newsletter'}).click();

        await expect(page.getByTestId('limit-modal')).toHaveText(/Your plan supports up to 1 newsletters/);
    });
});
