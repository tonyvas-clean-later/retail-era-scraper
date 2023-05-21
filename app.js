const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');

// Website to scrape
const BASE_URL = "https://retail.era.ca"
// Screen size
const VIEWPORT = {width: 1080, height: 1024};

// Dump output dir
const DUMP_DIR = `${__dirname}/dump`

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
        
        // List to hold scraped data
        let bigData = [];

        // Get urls of each collection
        // let collectionUrls = await getCollectionUrls(page);
        // let collectionUrls = [`${BASE_URL}/collections/cooling`, `${BASE_URL}/collections/tablets`, `${BASE_URL}/collections/servers`]
        let collectionUrls = [`${BASE_URL}/collections/cooling`]

        for (let collectionUrl of collectionUrls){
            // Get start time for collection
            let collectionStart = new Date().getTime();

            // List of data of all items in collection
            let collectionItemsData = [];

            // Push collection into big data object
            bigData.push({
                'url': collectionUrl,
                'items': collectionItemsData
            })

            // Get page urls of each collection
            let pageUrls = await getPageUrlsOfCollection(page, collectionUrl);

            for (let pageUrl of pageUrls){
                // Get item urls of each page
                let itemUrls = await getItemUrlsOfPage(page, pageUrl);

                for (let itemUrl of itemUrls){
                    try {
                        // Get parsed item data
                        let itemData = await getItemData(page, itemUrl);

                        // Push item data in item data list
                        collectionItemsData.push(itemData);
                    } catch (err) {
                        console.error(`Error: main: failed to parse data for item at '${itemUrl}'`, err);
                    }
                }
            }

            // Get end time for collection
            let collectionEnd = new Date().getTime();

            // Print time info for collection
            console.log(`Parsed collection '${collectionUrl}' with ${pageUrls.length} pages in ${(collectionEnd - collectionStart)/1000} sec`);

            // Dump collected data
            await dumpBigData(bigData);
        }
    }
    catch(err){
        console.error(`Error: main: Failed to scrape website`, err);
    }
    finally{
        // Close browser if it was opened
        if (browser){
            await browser.close();
        }
    }
}

function dumpBigData(data){
    return new Promise(async (resolve, reject) => {
        try {
            // Current date
            let date = new Date();
            
            // Get parts of date
            let year = date.getFullYear();
            let month = String(date.getMonth() + 1).padStart(2, '0');
            let day = String(date.getDate()).padStart(2, '0');
            let hour = String(date.getHours()).padStart(2, '0');
            let min = String(date.getMinutes()).padStart(2, '0');
            let sec = String(date.getSeconds()).padStart(2, '0');

            // Format dump file name
            let filename = `${year}-${month}-${day}_${hour}-${min}-${sec}.json`

            // Write to file
            fs.writeFileSync(`${DUMP_DIR}/${filename}`, JSON.stringify(data), 'utf-8');

            resolve();
        } catch (err) {
            reject(new Error('dumpBigData', err));
        }
    })
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
            data['url'] = itemUrl;
            data['images'] = getItemImages($, article);
            data['title'] = getItemTitle($, article);
            data['sku'] = getItemSku($, article);
            data['price_original'] = getItemPriceOriginal($, article);
            data['price_current'] = getItemPriceCurrent($, article);
            data['description'] = getItemDescription($, article);
            data['stock'] = getItemStock($, article);

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
        let title = $(article).find(`.${CLASS_NAME}`).text().trim();

        return title;
    } catch (err) {
        throw new Error('getItemTitle', err)
    }
}

function getItemSku($, article){
    try {
        // Class name for SKU
        const CLASS_NAME = 'custom-liquid'

        // Get SKU by class name
        let sku = $(article).find(`.${CLASS_NAME}`).text().trim();

        // Remove excess
        sku = sku.substr(4);            // Remove leading SKU:
        sku = sku.replace(/\n/g, ' ');  // Remove newlines
        sku = sku.trim();               // Remove surrounding whitespace

        return sku;
    } catch (err) {
        throw new Error('getItemSku', err)
    }
}

function getItemPriceOriginal($, article){
    try {
        // Attributes for price elements
        const PARENT_ATTR = 'data-price-compare-container=""'
        const PRICE_ATTR = 'data-price-compare=""'

        // Get price
        let price = $(article).find(`[${PARENT_ATTR}]`).find(`[${PRICE_ATTR}]`).text().trim();

        return price;
    } catch (err) {
        throw new Error('getItemPriceOriginal', err)
    }
}

function getItemPriceCurrent($, article){
    try {
        // Attributes for price elements
        const PARENT_ATTR = 'data-price-container=""'
        const PRICE_ATTR = 'data-price=""'

        // Get price
        let price = $(article).find(`[${PARENT_ATTR}]`).find(`[${PRICE_ATTR}]`).text().trim();

        return price;
    } catch (err) {
        throw new Error('getItemPriceCurrent', err)
    }
}

function getItemDescription($, article){
    try {
        // Class name for description
        const CLASS_NAME = 'product-description'

        // Get description elements
        let descElement = $(article).find(`.${CLASS_NAME}`)
        let descChildren = $(descElement).children();

        let desc = '';

        // Check if main element has children
        if (descChildren.length > 0){
            // If it does, then description texts are in them
            let parts = [];
            
            for (let child of descChildren){
                // Get every part of text from child
                parts.push($(child).text().trim())
            }

            // Join the parts into 1
            desc = parts.join('\n').trim();
        }
        else{
            // If there are no children, then element contains just text
            desc = descElement.text().trim();
        }

        return desc;
    } catch (err) {
        throw new Error('getItemDescription', err)
    }
}

function getItemStock($, article){
    try {
        // Tag name for stock element
        const TAG_NAME = 'strong'

        // Get stock by tag name
        let stock = $(article).find(TAG_NAME).text().trim();

        return stock;
    } catch (err) {
        throw new Error('getItemStock', err)
    }
}