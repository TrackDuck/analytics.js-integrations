
var push = require('global-queue')('_curebitq');
var replace = require('replace-document-write');
var Identify = require('facade').Identify;
var integration = require('integration');
var Track = require('facade').Track;
var iso = require('to-iso-string');
var onload = require('script-onload');
var extend = require('extend');
var clone = require('clone');
var each = require('each');
var type = require('type');
var when = require('when');
var load = require('load-script');


/**
 * User reference
 */

var user;

/**
 * Expose plugin
 */

module.exports = exports = function(analytics){
  analytics.addIntegration(Curebit);
  user = analytics.user();
};

/**
 * HOP
 */

var has = Object.prototype.hasOwnProperty;

/**
 * Expose `Curebit` integration
 */

var Curebit = exports.Integration = integration('Curebit')
  .readyOnInitialize()
  .global('_curebitq')
  .global('curebit')
  .option('siteId', '')
  .option('iframeWidth', '100%')
  .option('iframeHeight', '480')
  .option('iframeBorder', 0)
  .option('iframeId', '')
  .option('responsive', true)
  .option('device', '')
  .option('insertIntoId', 'curebit-frame')
  .option('campaigns', {})
  .option('server', 'https://www.curebit.com');

/**
 * Initialize
 *
 * @param {Object} page
 */

Curebit.prototype.initialize = function(){
  push('init', {
    site_id: this.options.siteId,
    server: this.options.server
  });
  this.load();
  this.registerAffiliate();
};

/**
 * Loaded?
 *
 * @return {Boolean}
 */

Curebit.prototype.loaded = function(){
  return !! window.curebit;
};

/**
 * Load
 *
 * Custom load script because Curebit's javascript needs to be injected
 * right next to where the iframe will appear.
 *
 * @param {Function} fn
 * @api private
 */

Curebit.prototype.load = function(fn){
  var url = '//d2jjzw81hqbuqv.cloudfront.net/integration/curebit-1.0.min.js';
  var tags = this.campaignTags();
  if (!tags.length)
    load(url, fn);
  else
    this.injectIntoId(url, this.options.insertIntoId, fn);
};

/**
 * Insert script into element with ID.
 *
 * If we *are* loading a campaign, we need to wait for this element to exist.
 *
 * @param {String} url
 * @param {String} id
 * @param {Function} fn
 * @api private
 */

Curebit.prototype.injectIntoId = function(url, id, fn) {
  var server = this.options.server;
  when(function () {
    return document.getElementById(id);
  }, function () {
    var script = document.createElement('script');
    script.src = url;
    var parent = document.getElementById(id);
    parent.appendChild(script);
    onload(script, fn);
  });
};

/**
 * Campaign tags.
 *
 * @api private
 */

Curebit.prototype.campaignTags = function(){
  var campaigns = this.options.campaigns;
  var path = window.location.pathname;
  if (!has.call(campaigns, path)) return [];
  var str = campaigns[path] || '';
  return str.split(',');
};

/**
 * Register affiliate.
 *
 * http://www.curebit.com/docs/affiliate/registration
 *
 * @api private
 */

Curebit.prototype.registerAffiliate = function(){
  // Get the campaign tags for this url.
  var tags = this.campaignTags();
  if (!tags.length) return;

  // Set up the basic iframe rendering.
  var data = {
    responsive: this.options.responsive,
    device: this.options.device,
    iframe: {
      width: this.options.iframeWidth,
      height: this.options.iframeHeight,
      id: this.options.iframeId,
      frameborder: this.options.iframeBorder,
      container: this.options.insertIntoId
    },
    campaign_tags: tags
  };

  // Add affiliate member info if available.
  var identify = new Identify({
    userId: user.id(),
    traits: user.traits()
  });
  if (identify.email()) {
    data.affiliate_member = {
      email: identify.email(),
      first_name: identify.firstName(),
      last_name: identify.lastName(),
      customer_id: identify.userId()
    };
  }

  push('register_affiliate', data);
};

/**
 * Completed order
 *
 * https://www.curebit.com/docs/ecommerce/custom
 *
 * @param {Track} track
 * @api private
 */

Curebit.prototype.completedOrder = function(track){
  var orderId = track.orderId();
  var products = track.products();
  var props = track.properties();
  var items = [];

  // identify
  var identify = new Identify({
    traits: user.traits(),
    userId: user.id()
  });

  // items
  each(products, function(product){
    var track = new Track({ properties: product });
    items.push({
      product_id: track.id() || track.sku(),
      quantity: track.quantity(),
      image_url: product.image,
      price: track.price(),
      title: track.name(),
      url: product.url,
    });
  });

  // transaction
  push('register_purchase', {
    order_date: iso(props.date || new Date),
    order_number: orderId,
    coupon_code: track.coupon(),
    subtotal: track.total(),
    customer_id: identify.userId(),
    first_name: identify.firstName(),
    last_name: identify.lastName(),
    email: identify.email(),
    items: items
  });
};
