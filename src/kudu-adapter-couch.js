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

  constructor( kudu, config = {} ) {

    // We use CouchPromised to interface with CouchDB. If we don't have the
    // required connection details we can't do anything.
    const { host, port, path } = config;

    if ( !host || !port || !path ) {
      throw new Error('A CouchDB host, port and path are required.');
    }

    // If a custom "document to model" function is not provided we default to
    // one that maps "_id" to "id" and removes the "Id" suffix from any keys
    // that refer to to-one relationships, and removes the "Ids" suffix from
    // those that refer to to-many relationships.
    if ( typeof config.documentToModel !== 'function' ) {

      config.documentToModel = ( doc ) => {

        const Model = kudu.getModel(doc.type);
        const relationships = Model.schema.relationships;

        Object.keys(doc).forEach(( key ) => {

          const match = key.match(/Id(s?)$/);

          if ( match ) {

            // If the regex didn't find anything to match the captured group we
            // have a key corresponding to a to-one relationship. If it did it's
            // a to-many relationship.
            const newKey = key.substring(
              0, key.length - ( match [ 1 ] ? 3 : 2 )
            );

            doc[ newKey ] = doc[ key ];
            delete doc[ key ];
          }
        });

        doc.id = doc._id;
        delete doc._id;

        return doc;
      };
    }

    // If a custom "model to document" function is not provided we default to
    // one that removes any non-serializable properties from the instance and
    // adds the "Id" suffix to any keys that refer to relationships. The suffix
    // is used by some of the generic views to retrieve documents based on a
    // relationship. We also rename the "id" property required by Kudu to "_id"
    // as required by CouchDB.
    if ( typeof config.modelToDocument !== 'function' ) {

      config.modelToDocument = ( instance ) => {

        const relationships = instance.constructor.schema.relationships;
        const doc = instance.toJSON();

        Object.keys(doc).forEach(( key ) => {

          if ( relationships[ key ] ) {

            const prop = doc[ key ];

            if ( prop.id ) {
              doc[ `${ key }Id` ] = prop.id;
            } else if ( Array.isArray(prop) && prop[ 0 ].id ) {
              doc[ `${ key }Ids` ] = prop.map(( item ) => item.id);
            }

            delete doc[ key ];
          }
        });

        if ( instance.id ) {
          doc._id = doc.id;
          delete doc.id;
        }

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
    config.views.related = config.views.related || {
      design: 'kudu-adapter-couch',
      view: 'type-ancestor_type-ancestor_id',
    };

    this.kudu = kudu;
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
    const doc = this.config.modelToDocument(instance);

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

    const isArray = Array.isArray(id);
    const method = isArray ? 'fetch' : 'get';

    return this.couch[ method ](id)
    .then(( res ) => isArray ?
      {
        rows: res.map(this.config.documentToModel.bind(this.config)),
      } :
      this.config.documentToModel(res)
    );
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

    return this.couch.view(doc.design, doc.view, {
      rootKey: [ type ],
      include_docs: true,
    })
    .then(( res ) => {

      return {
        rows: res.rows.map(( row ) => this.config.documentToModel(row.doc)),
      };
    });
  }

  getRelated( ancestorType, ancestorId, relationship ) {

    if ( !ancestorType || !ancestorId || !relationship ) {
      throw new Error(
        'Expected an ancestor type, an identifier and a relationship object.'
      );
    }

    const doc = this.config.views.related;

    if ( !doc.design || !doc.view ) {
      throw new Error('No CouchDB view available for type queries.');
    }

    return this.couch.view(doc.design, doc.view, {
      key: [ relationship.type, ancestorType, ancestorId ],
      include_docs: true,
    })
    .then(( res ) => {

      if ( relationship.hasMany ) {
        return {
          rows: res.rows.map(( row ) => this.config.documentToModel(row.doc)),
        };
      }

      return this.config.documentToModel(res.rows[ 0 ].doc);
    });
  }

  // Update a Kudu model instance that is already stored in CouchDB.
  update( instance ) {

    // If we don't have an instance, or the instance does not appear to be a
    // Kudu model we can't try to update it.
    if ( !instance || !instance.toJSON ) {
      throw new Error('Expected a Kudu model instance to update.');
    }

    // Prepare the instance for serialization. This removes any properties that
    // would otherwise cause serialization to fail such as circular references.
    const doc = this.config.modelToDocument(instance);

    return this.couch.update(doc)
    .then(( res ) => {

      // CouchDB responds with an object containing a new revision for the
      // updated document. We add that to the original instance and return it
      // (rather than a new instance).
      instance._rev = res._rev;

      return instance;
    });
  }

  //
  // Methods from this point onwards are specific to the CouchDB adapter. Those
  // listed previously should be common to all Kudu adapters.
  //

  //
  getFromView( design = '', view = '', config = {} ) {

    if ( !design || !view ) {
      throw new Error('Expected a design document identifier and view.');
    }

    return this.couch.viewDocs(design, view, config)
    .then(( docs ) => docs.map(this.config.documentToModel));
  }
}
