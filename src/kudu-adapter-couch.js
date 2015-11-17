import CouchPromised from 'couch-promised';

// A CouchDB database adapter for Kudu applications. Note that since Kudu relies
// upon the "id" property of model instances this adapter maps the CouchDB "_id"
// property to "id" (with no underscore). It does not remove the underscore from
// the "_rev" property.
//
// Usage:
//
//   ```
//   import CouchAdapter from 'kudu-adapter-couch';
//
//   const app = new Kudu(expressApp, {
//     adapter: {
//       type: CouchAdapter,
//       config: {
//         host: COUCHDB_HOST,
//         port: COUCHDB_PORT,
//         path: COUCHDB_PATH,
//       },
//     },
//   });
//   ```
//
export default class CouchAdapter {

  constructor( config = {} ) {

    // We use CouchPromised to interface with CouchDB. If we don't have the
    // required connection details we can't do anything.
    const { host, port, path } = config;

    if ( !host || !port || !path ) {
      throw new Error('A CouchDB host, port and path are required.');
    }

    // If a custom "document to model" function is not provided we default to
    // one that simply maps "_id" to "id".
    if ( typeof config.documentToModel !== 'function' ) {

      config.documentToModel = ( doc ) => {

        doc.id = doc._id;
        delete doc._id;

        return doc;
      };
    }

    // If custom views are not provided we default to the ones in the included
    // design document.
    config.views = config.views || Object.create(null);
    config.views.type = config.views.type || {
      design: 'kudu-adapter-couch',
      view: 'type_id',
    };

    this.config = config;
    this.couch = new CouchPromised({
      host,
      port,
      path,
    });
  }

  // Persist a Kudu model instance to CouchDB.
  create( instance ) {

    // If we don't have an instance, or the instance does not appear to be a
    // Kudu model we can't try to save it.
    if ( !instance || !instance.toJSON ) {
      throw new Error('Expected a Kudu model instance to save.');
    }

    // Prepare the instance for serialization. This removes any properties that
    // would otherwise cause serialization to fail such as circular references.
    const doc = instance.toJSON();

    return this.couch.insert(doc)
    .then(( res ) => {

      // CouchDB responds with an object containing a unique identifier and
      // revision for the newly saved document. We add those to the original
      // instance and return it (rather than a new instance).
      instance.id = res._id;
      instance._rev = res._rev;

      return instance;
    });
  }

  // Get a Kudu model instance by type and unique identifier.
  get( type, id ) {

    if ( !type || !id ) {
      throw new Error('Expected a Kudu model type and unique identifier.');
    }

    return this.couch.get(id)
    .then(( res ) => this.config.documentToModel(res));
  }

  // Get all documents representing a given Kudu model type.
  getAll( type ) {

    if ( !type ) {
      throw new Error('Expected a Kudu model type.');
    }

    // A CouchDB view is required for "get all by type" queries. The default
    // view emits all documents by "type" and "_id". If a view is not defined
    // for this action we throw an error.
    const doc = this.config.views.type;

    if ( !doc.design || !doc.view ) {
      throw new Error('No CouchDB view available for type queries.');
    }

    return this.couch.view(doc.design, doc.view)
    .then(( res ) => {

      return {
        rows: res.rows.map(( row ) => this.config.documentToModel(row.doc)),
      };
    });
  }
}
