const cheerio = require('cheerio');
const request = require('request');
const api = require('twitch-api-v5');
const urlParser = require('js-video-url-parser');

function twitchParser(url) {
    const info = urlParser.parse(url);
    if(info && ['twitch', 'youtube'].indexOf(info.provider) > -1 ) {
        info.embed = urlParser.create({
            videoInfo: info,
            format: 'embed',
            params: {
                allowfullscreen: 1,
                autoplay: 1,
            }
        })
    }
    return info || null;
};

function twitchSEO(meta, twitchInfo, twitchClientID, resolve) {
    api.clientID = twitchClientID;
    switch(twitchInfo.mediaType) {
        case 'stream':
            api.users.usersByName({users: twitchInfo.channel}, (err, res) => {
                if (!err && res.users && res.users.length) {
                    const user = res.users[0];
                    meta.title = user.display_name;
                    meta.description = user.bio || meta.title;
                    meta.image = user.logo;
                }
                resolve(meta);
            })
            break;
        case 'clip':
            api.clips.getClip( {slug: twitchInfo.id}, (err, res) => {
                if (!err) {
                    meta.title = res.title;
                    meta.description = res.title || meta.title;
                    meta.image = res.thumbnails.medium;
                    meta.ogVideoUrl = res.embed_url;
                }
                resolve(meta);
            });
            break;
        case 'video':
            api.videos.getVideo({videoID: twitchInfo.id}, (err, res) => {
                if (!err) {
                    meta.title = res.title;
                    meta.description = res.title || meta.title;
                    meta.image = res.preview.large;
                }
                resolve(meta);
            });
            break;
        default:
            resolve(meta);
    }
};

function collectTwitchMeta(meta, twitchClientID) {
    return new Promise((resolve, reject) => {
        const twitchInfo = twitchParser(meta.url);
        if (twitchInfo && twitchClientID) {
            meta.ogVideoUrl = twitchInfo.embed;
            if (twitchInfo.provider === 'twitch'){
                twitchSEO(meta, twitchInfo, twitchClientID, resolve)
                return;
            }
        }
        resolve(meta);
    });
};

const getByProp = ($, property) =>
    $(`meta[property='${property}']`)
        .first()
        .attr("content") || null;

const getByTag = ($, property) =>
    $('title')
        .first()
        .html() || null;

function collectMeta($, url, twitchClientID) {
    const ogUrl = getByProp($, "og:url");
    const ogVideoUrl = getByProp($, "og:video:secure_url") || getByProp($, "og:video:url") || "";

    const res = {
        url,
        image: getByProp($, "og:image"),
        imageWidth: getByProp($, "og:image:width"),
        imageHeight: getByProp($, "og:image:height"),
        imageType: getByProp($, "og:image:type"),
        title: getByProp($, "og:title") || getByTag($, 'title'),
        description: getByProp($, "og:description") || getByProp($, "description") || getByProp($, "Description"),
        siteName: getByProp($, "og:site_name"),
        ogVideoUrl,
        ogUrl,
    };
    return collectTwitchMeta(res, twitchClientID);
}

const getValue = (url, name) => {
    const i = url.indexOf(`${name}=`) + name.length + 1;
    const j = url.indexOf("&", i);
    const end = j < 0 ? url.length : j;
    return i < 0 ? "" : url.slice(i, end);
};

const getError = url => ({
    url,
    image: null,
    imageWidth: null,
    imageHeight: null,
    imageType: null,
    title: undefined,
    description: null,
    siteName: null
});

function linkPreview(url, timeout = 100000, twitchClientID = null) {
    if (!url || url === "") return Promise.reject({message: "You must add a valid url"});
    // if (!url.match(/^http:\/\/\w+(\.\w+)*(:[0-9]+)?\/?$/i)) return Promise.resolve(getError(url));
    return linkPreview.makeRequest(url, timeout).then(({response, body}) => {
        if (!response) return getError(url);
        if (response.statusCode === 200) return collectMeta(cheerio.load(body), url, twitchClientID);
        return getError(url);
    });
}

linkPreview.makeRequest = (url, timeout) =>
    new Promise((resolve, reject) => {
        request(url, {timeout: timeout}, (error, response, body) => resolve({body, response}));
    });

module.exports = linkPreview;
