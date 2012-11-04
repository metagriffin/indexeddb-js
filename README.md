jsindexeddb
===========

Welcome to the `jsindexeddb` javascript/node-js module: a
pure-javascript stop-gap implementation of the IndexedDB (aka. Indexed
Database) API. Being "stop-gap", it currently does not implement all
IndexedDB API features and can only use
[sqlite3](https://npmjs.org/package/sqlite3) as a data storage
back-end.

Just To Be Clear
================

This module is not intended to provide a "production" level
implementation: it is a "stop-gap" measure while we (the community)
wait for a more robust/native implementation for node-js. As such, it
was created to allow unit-testing of other projects (such as
[jssyncml](https://npmjs.org/package/jssyncml) and others), which
require that you provide access to an indexedDB API, but need to be
unit-tested in any environment, including non-browser environments.

If time permits, and/or others are willing to contribute, it may
one day graduate to a less "stop-gap" measure.

What Isn't Implemented
======================

There are many IndexedDB API items that are not implemented, which
include but are not limited to:

* True transaction support, i.e. transaction isolation, aborting
  (rollback), and transaction events (oncomplete).

* Proper meta-information upgrade management.

* Many of the dynamic public API properties of various object types.

* Compliance with any of the DOMException errors.

* Many non-critical API methods, including:

    * indexedDB.deleteDatabase()
    * indexedDB.cmp()
    * Database.close()
    * Database.deleteObjectStore()
    * Transaction.abort()
    * Store.clear()
    * Store.count()
    * Store.deleteIndex()
    * Index.count()
    * Cursor.update()
    * Cursor.advance()
    * Cursor.delete()

* Performance and efficiency (it was implemented one Saturday
  afternoon).

* Non-sqlite3 data stores.

Installation
============

This is the easy part, provided you have ``npm`` installed:

    npm install jsindexeddb sqlite3

Usage
=====

A quick example of how to use `jsindexeddb`:

``` js

// assuming modules 'sqlite3' and 'jsindexeddb' have been loaded
// in your environment-specific way, e.g. with `define` or `require`.

// of course, if you are being nice to the community, you would wrap the
// following in a call to "define()" and would share your code as a
// non-environment-specific javascript module.  see
//   http://manuel.kiessling.net/2012/03/30/true-universal-javascript-modules-with-write-once-run-anywhere-jasmine-specs/
// for details... ;-)

var engine    = new sqlite3.Database(':memory:');
var indexedDB = new jsindexeddb.indexedDB('sqlite3', engine);
var request   = indexedDB.open('MyDatabase');
var db        = null;

request.onerror = function(event) {
  console.log('ERROR: could not open database: ' + event.target.result.error);
};

request.onupgradeneeded = function(event) {
  db = event.target.result;
  var store = db.createObjectStore('data', {keyPath: 'id'});
  store.createIndex('value', 'value', {unique: false});
  store.add({id: 1, value: 'my-first-item'}).onsuccess = function() {
    request.run();
  };
};

request.onsuccess = function(event) {
  db = event.target.result;
  request.run();
};

request.run = function() {

  // register an error handler for any error on the current db
  db.onerror = function(event) {
    console.log('DATABASE ERROR: ' + event.target.error);
  };

  // fetch the record with id "1" in store "data"
  var store = db.transaction(null, 'readwrite').objectStore('data');
  store.get('1').onsuccess = function(event) {
    var obj = event.target.result;
    console.log('record: ' + JSON.stringify(obj));

    // now delete it
    store.delete('1').onsuccess = function(event) {
      console.log('deleted the record');

      // and now add a couple new records (overwriting it if the key
      // already exists) with the same 'value' (so we can play with cursors)
      store.put({id: '2', value: 'another object'}).onsuccess = function(event) {
        store.put({id: 3, value: 'another object'}).onsuccess = function(event) {
          console.log('added two more records');

          // we're getting pretty deeply nested here... let's pop out
          // and use the index
          play_with_the_index_and_cursors();

        };
      };
    };
  };

  var play_with_the_index_and_cursors = function() {

    var index = db.transaction(null, 'readwrite').objectStore('data').index('value');

    console.log('all objects with the "value" field set to "another object":');

    index.openCursor('another object').onsuccess = function(event) {
      var cursor = event.target.result;
      if ( ! cursor )
        return;
      console.log('  - ' + JSON.stringify(cursor.value));
      cursor.continue();
    };

  };

};
```

Note that `jsindexeddb` implements the Indexed Database API as
accurately as possible, so just
[google](http://lmgtfy.com/?q=indexeddb) for the specification and
many good tutorials. My favorite:

* [https://developer.mozilla.org/en-US/docs/IndexedDB/Using_IndexedDB]

Tests
=====

`jsindexeddb` uses [jasmine](http://pivotal.github.com/jasmine/) for
the testing infrastructure; in the jsindexeddb directory:

    npm install jasmine-node
    make tests
