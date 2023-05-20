const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

// Website to scrape
const BASE_URL = "https://retail.era.ca"
// Screen size
const VIEWPORT = {width: 1080, height: 1024};

// Skip collection containing all items, as more specific collection include them
const COLLECTION_BLACKLIST = [ '/collections/all' ];

// Main method
main();

async function main(){
    let browser = null;

    try{
        // Create browser and page for scraping
        browser = await puppeteer.launch();
        let page = await browser.newPage();
        
        // // List to hold scraped data
        // let bigData = [];

        // // Get urls of each collection
        // let collectionUrls = await getCollectionUrls(page);

        // for (let collectionUrl of collectionUrls){
        //     // Get start time for collection
        //     let collectionStart = new Date().getTime();

        //     // List of data of all items in collection
        //     let collectionItemsData = [];

        //     // Push collection into big data object
        //     bigData.push({
        //         'url': collectionUrl,
        //         'items': collectionItemsData
        //     })

        //     // Get page urls of each collection
        //     let pageUrls = await getPageUrlsOfCollection(page, collectionUrl);

        //     for (let pageUrl of pageUrls){
        //         // Get item urls of each page
        //         let itemUrls = await getItemUrlsOfPage(page, pageUrl);

        //         for (let itemUrl of itemUrls){
        //             try {
        //                 // Get parsed item data
        //                 let itemData = await getItemData(page, itemUrl);

        //                 // Push item data in item data list
        //                 collectionItemsData.push(itemData);
        //             } catch (err) {
        //                 console.error(`Error: main: failed to parse data for item at '${itemUrl}'`, err);
        //             }
        //         }
        //     }

        //     // Get end time for collection
        //     let collectionEnd = new Date().getTime();

        //     // Print time info for collection
        //     console.log(`Parsed collection '${collectionUrl}' with ${pageUrls.length} pages in ${collectionEnd - collectionStart}ms`);
        // }

        for (let collection of ['cooling'/*, 'tablets', 'servers'*/]){
            let collectionStart = new Date().getTime();

            let pageUrls = await getPageUrlsOfCollection(page, `https://retail.era.ca/collections/${collection}`);
                for (let pageUrl of pageUrls){
                let itemUrls = await getItemUrlsOfPage(page, pageUrl);
                for (let itemUrl of itemUrls){
                    try {
                        let itemData = await getItemData(page, itemUrl);
                        console.log(itemData);
                    } catch (err) {
                        console.error(`Error: main: failed to parse data for item at '${itemUrl}'`, err);
                    }
                }
            }

            let collectionEnd = new Date().getTime();
            console.log(`Parsed collection '${collection}' with ${pageUrls.length} pages in ${collectionEnd - collectionStart}ms`);
        }
    }
    catch(err){
        console.error(`Error: main: Failed to navigate website`, err);
    }
    finally{
        // Close browser if it was opened
        if (browser){
            await browser.close();
        }
    }
}

function getHtmlOfUrl(page, url){
    return new Promise(async (resolve, reject) => {
        try{
            // Navigate in page
            await page.goto(url);
            await page.setViewport(VIEWPORT);

            // Download the html
            let html = await page.content();
            
            // Resolve html data
            resolve(html);
        }
        catch(err){
            reject(new Error('getHtmlOfUrl', err));
        }
    })
}

function getCollectionUrls(page){
    return new Promise(async (resolve, reject) => {
        try{
            // List of urls pointing to collections
            let urls = []
            
            // Get HTML of home page
            let html = await getHtmlOfUrl(page, BASE_URL);

            // Parse HTML
            let $ = cheerio.load(html);

            // Get the first nav element
            let nav = $('nav')[0]

            // Get the anchors in nav
            let anchors = $(nav).find('a')

            // Get the urls from anchors
            for (let anchor of anchors){
                let href = $(anchor).attr('href');
                if (!COLLECTION_BLACKLIST.includes(href)){
                    urls.push(`${BASE_URL}${href}`);
                }
            }

            // Resolve urls
            resolve(urls);
        }
        catch(err){
            reject(new Error('getCollectionUrls', err));
        }
    })
}

function getPageUrlsOfCollection(page, collectionUrl){
    return new Promise(async (resolve, reject) => {
        try{
            // List of urls pointing to collection pages
            let urls = [];

            // HTML data of collection page
            let html = await getHtmlOfUrl(page, collectionUrl);

            // Parse HTML
            let $ = cheerio.load(html);

            // Get page nav by class name at bottom of page
            let navs = $('.pagination--inner');

            if (navs.length > 0){
                // If nav exists, then there are multiple pages
                // Get the nav element
                let nav = navs[0];
                // Get the number of elements in nav (page numbers), minus the 'Next' button
                let count = $(nav).children().length - 1
                for (let i = 0; i < count; i++){
                    // Create page url
                    urls.push(`${collectionUrl}?page=${i + 1}`);
                }
            }
            else{
                // If there is no nav, then there is only 1 page
                // Page url is same as collection url
                urls.push(collectionUrl);
            }

            resolve(urls);
        }
        catch(err){
            reject(new Error('getPageUrlsOfCollection', err));
        }
    })
}

function getItemUrlsOfPage(page, pageUrl){
    return new Promise(async (resolve, reject) => {
        try{
            // List of urls pointing to item pages
            let urls = [];

            // HTML data of page
            let html = await getHtmlOfUrl(page, pageUrl);

            // Parse HTML
            let $ = cheerio.load(html);

            // Get UL element matching attribute
            let itemUl = $('[data-html="productgrid-items"]')

            // Get anchors matching attribute, pointing to each item on page
            let anchors = $(itemUl).find('[tabindex="-1"]')
            for (let anchor of anchors){
                // Get href and generate url
                let href = $(anchor).attr('href');
                urls.push(`${BASE_URL}${href}`);
            }

            resolve(urls);
        }
        catch(err){
            reject(new Error('getItemUrlsOfPage', err));
        }
    })
}

function getItemData(page, itemUrl){
    return new Promise(async (resolve, reject) => {
        try{
            // Item data object
            let data = {};
            
            // HTML data of item page
            let html = await getHtmlOfUrl(page, itemUrl);

            // Parse HTML
            let $ = cheerio.load(html);

            // Get article element
            let article = $('article')[0];

            // Populate object
            data['images'] = getItemImages($, article);
            data['title'] = getItemTitle($, article);
            // data['sku'] = getItemSku($, article);
            // data['price_original'] = getItemPriceOriginal($, article);
            // data['price_current'] = getItemPriceCurrent($, article);
            // data['description'] = getItemDescription($, article);
            // data['stock'] = getItemStock($, article);

            resolve(data)
        }
        catch(err){
            reject(new Error('getItemData', err));
        }
    })
}

function getItemImages($, article){
    try {
        // Class name for images in gallery nav
        const CLASS_NAME = 'product-gallery--media-thumbnail-img'

        // List of image src
        let images = [];

        // Gallery element
        let gallery = $(article).children()[0];
        // Image elements in gallery nav
        let imgs = $(gallery).find(`.${CLASS_NAME}`);

        for (let img of imgs){
            // Get src from element
            let src = $(img).attr('src');

            // Get the start and end index of bad data from src (shopify API)
            let startI = src.indexOf('_');
            let endI = src.indexOf('.', startI);

            // Get substrings around the bad data
            let start = src.substr(0, startI);
            let end = src.substr(endI);

            // Format the substrings into url
            images.push(`https:${start}${end}`);
        }

        return images
    } catch (err) {
        throw new Error('getItemImages', err)
    }
}

function getItemTitle($, article){
    try {
        // Class name for title
        const CLASS_NAME = 'product-title'

        // Get title by class name
        let title = $(article).find(`.${CLASS_NAME}`).html().trim();

        return title;
    } catch (err) {
        throw new Error('getItemTitle', err)
    }
}

function getItemSku($, article){
    try {
        
    } catch (err) {
        throw new Error('getItemSku', err)
    }
}

function getItemPriceOriginal($, article){
    try {
        
    } catch (err) {
        throw new Error('getItemPriceOriginal', err)
    }
}

function getItemPriceCurrent($, article){
    try {
        
    } catch (err) {
        throw new Error('getItemPriceCurrent', err)
    }
}

function getItemDescription($, article){
    try {
        
    } catch (err) {
        throw new Error('getItemDescription', err)
    }
}

function getItemStock($, article){
    try {
        
    } catch (err) {
        throw new Error('getItemStock', err)
    }
}