'use strict';

var argv            = require('minimist')(process.argv.slice(2));
var RSVP            = require('rsvp');
var mapSeries       = require('promise-map-series');
var github          = require('octonode');
var parseLinkHeader = require('parse-link-header');

var username = argv.u;
var password = argv.p;
var orgName  = argv.o;

if (!username) {
  throw new Error('You must provide a username as the -u argument');
}

if (!password) {
  throw new Error('You must provide a password as the -p argument');
}

if (!orgName) {
  throw new Error('You must provide a organization name as the -o argument');
}

var client = github.client({
  username: username,
  password: password
});
var ghme = client.me();

getAllWatchedRepos()
  .then(function(repos) {
    console.log('Currently watching ' + repos.length + ' repos.');
    return repos;
  })
  .then(onlyOrgRepos)
  .then(unwatchAllRepos)
  .then(function(unwatchedRepos) {
    console.log('Unwatched ' + unwatchedRepos.length + ' repos.');
  })
  .catch(function(err) {
    console.log('Error:');
    console.log(err);
  });

function unwatchAllRepos(repos) {
  return mapSeries(repos, unwatchRepo);
}

function unwatchRepo(repo) {
  var owner        = repo.owner.login;
  var repo         = repo.name;
  var fullName     = owner + '/' + repo;
  var clientDelete = RSVP.denodeify(client.del.bind(client));

  console.log('Unwatch: ' + owner + '/' + repo);
  return clientDelete('/repos/' + fullName + '/subscription', {}).then(function() {
    return fullName;
  });
}

function onlyOrgRepos(repos) {
  return repos.filter(function(repo) {
    return repo.owner.login === orgName;
  });
}

function watchedRepos(page, allRepos, cb) {
  ghme.watched(page, 100, function(err, res, headers) {
    if (err) { return cb(err); }

    allRepos = allRepos.concat(res);

    var nextPage = hasNextPage(headers);

    if (nextPage) {
      watchedRepos(nextPage, allRepos, cb);
    } else {
      cb(null, allRepos);
    }
  });
}

function getAllWatchedRepos() {
  var watchedReposPromise = RSVP.denodeify(watchedRepos);

  return watchedReposPromise(1, []);
}

function hasNextPage(headers) {
  var link = parseLinkHeader(headers.link);
  return link.next && link.next.page;
}
