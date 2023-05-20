const puppeteer = require('puppeteer');
const cheerio = require('cheerio');

const BASE_URL = "https://retail.era.ca"
const VIEWPORT = {width: 1080, height: 1024};

const COLLECTION_BLACKLIST = [ '/collections/all' ];

console.clear();
main();

async function main(){
    let browser = null;

    try{
        browser = await puppeteer.launch();
        let page = await browser.newPage();
        
        // let collections = await getCollections(page);
        // for (let collection of collections){
        //     let items = await getCollectionItems(page, collection);
        // }

        let test = [
            'https://retail.era.ca/collections/cooling'
            // 'https://retail.era.ca/collections/tablets',
            // 'https://retail.era.ca/collections/servers'
        ]

        for (let collectionUrl of test){
            let items = await getCollectionItems(page, collectionUrl);
            console.log(items);
        }
    }
    catch(err){
        console.error('Error: main:', err);
    }
    finally{
        if (browser){
            await browser.close();
        }
    }
}

function getCollections(page){
    return new Promise(async (resolve, reject) => {
        try{
            await page.goto(BASE_URL);
            await page.setViewport(VIEWPORT);

            setTimeout(async () => {
                let html = await page.content();
                let $ = cheerio.load(html);
                let collectionUrls = []

                let nav = $('nav')[0]
                let anchors = $(nav).find('a')

                for (let anchor of anchors){
                    let href = $(anchor).attr('href');
                    if (!COLLECTION_BLACKLIST.includes(href)){
                        collectionUrls.push(`${BASE_URL}${href}`);
                    }
                }

                resolve(collectionUrls);
            }, 1000);
        }
        catch(err){
            reject(new Error('getCollections:', err));
        }
    })
}

function getCollectionItems(page, collectionUrl){
    return new Promise(async (resolve, reject) => {
        try{
            let pagesUrls = await getCollectionPages(page, collectionUrl);
            let itemsUrls = [];

            for (let pageUrl of pagesUrls){
                let items = await getPageItems(page, pageUrl);
                for (let item of items){
                    itemsUrls.push(item);
                }
            }

            resolve(itemsUrls)
        }
        catch(err){
            reject(new Error('getCollectionItems:', err));
        }
    })
}

function getPageItems(page, pageUrl){
    return new Promise(async (resolve, reject) => {
        try{
            let itemsUrls = [];

            await page.goto(pageUrl);
            await page.setViewport(VIEWPORT);

            let html = await page.content();
            let $ = cheerio.load(html);

            let itemUl = $('[data-html="productgrid-items"]')
            let anchors = $(itemUl).find('[tabindex="-1"]')
            for (let anchor of anchors){
                let href = $(anchor).attr('href');
                itemsUrls.push(`${BASE_URL}${href}`);
            }

            resolve(itemsUrls);
        }
        catch(err){
            reject(new Error('getPageItems:', err));
        }
    })
}

function getCollectionPages(page, collectionUrl){
    return new Promise(async (resolve, reject) => {
        try{
            let pagesUrls = [];

            await page.goto(collectionUrl);
            await page.setViewport(VIEWPORT);

            let html = await page.content();
            let $ = cheerio.load(html);

            let navs = $('.pagination--inner');
            if (navs.length > 0){
                let nav = navs[0];
                let children = $(nav).children()
                for (let i = 0; i < children.length - 1; i++){
                    pagesUrls.push(`${collectionUrl}?page=${i + 1}`);
                }
            }
            else{
                pagesUrls.push(collectionUrl);
            }

            resolve(pagesUrls);
        }
        catch(err){
            reject(new Error('getCollectionPages:', err));
        }
    })
}