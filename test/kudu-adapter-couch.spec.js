import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import proxyquire from 'proxyquire';

class MockCouch {
  constructor( config = {} ) {}
  insert( doc ) {

    return Promise.resolve({
      _id: '1',
      _rev: '1',
    });
  }
  update( doc ) {

    return Promise.resolve({
      _id: '1',
      _rev: '2',
    });
  }
  get( id ) {

    return Promise.resolve(
      Array.isArray(id) ?
        [
          {
            _id: '1',
            _rev: '1',
          },
        ] :
        {
          _id: '1',
          _rev: '1',
        }
    );
  }
  fetch( ids ) {

    return Promise.resolve([
      { _id: '1', _rev: '1' },
    ]);
  }
  view( design, view ) {

    return Promise.resolve({
      rows: [
        { doc: { _id: '1', _rev: '1' } },
        { doc: { _id: '2', _rev: '1' } },
      ],
    });
  }
  viewDocs( design, view ) {

    return Promise.resolve([
      { _id: '1', _rev: '1' },
      { _id: '2', _rev: '1' },
    ]);
  }
}

class MockKudu {
  getModel() {
    return MockModel;
  }
}

class MockModel {
  static schema = {
    properties: {},
    relationships: {
      linked: {
        type: 'link',
      },
    },
  }
  constructor( data = {} ) {
    Object.assign(this, data);
  }
  toJSON() {
    return Object.assign({}, this);
  }
}

const Adapter = proxyquire('../src/kudu-adapter-couch', {
  'couch-promised': MockCouch,
});

chai.use(chaiAsPromised);
let expect = chai.expect;

describe('Kudu CouchDB adapter', () => {

  let kudu;

  beforeEach(() => {
    kudu = new MockKudu();
  });

  it('should throw if a host is not provided', () => {
    let test = () => new Adapter(kudu, {
      port: 5984,
      path: '/test',
    });
    expect(test).to.throw(Error, /host/);
  });

  it('should throw if a port is not provided', () => {
    let test = () => new Adapter(kudu, {
      host: 'http://127.0.0.1',
      path: '/test',
    });
    expect(test).to.throw(Error, /port/);
  });

  it('should throw if a path is not provided', () => {
    let test = () => new Adapter(kudu, {
      host: 'http://127.0.0.1',
      port: 5984,
    });
    expect(test).to.throw(Error, /path/);
  });

  it('should expose the config object', () => {
    expect(new Adapter(kudu, {
      host: 'http://127.0.0.1',
      port: 5984,
      path: '/test',
    })).to.have.property('config').that.is.an('object');
  });

  it('should allow a custom "document to model" function', () => {
    let documentToModel = () => {};
    expect(new Adapter(kudu, {
      host: 'http://127.0.0.1',
      port: 5984,
      path: '/test',
      documentToModel,
    }).config).to.have.property('documentToModel', documentToModel);
  });

  it('should expose a default "view" config', () => {
    expect(new Adapter(kudu, {
      host: 'http://127.0.0.1',
      port: 5984,
      path: '/test',
    }).config).to.have.property('views');
  });

  it('should expose a CouchDB interface', () => {
    expect(new Adapter(kudu, {
      host: 'http://127.0.0.1',
      port: 5984,
      path: '/test',
    })).to.have.property('couch').that.is.an.instanceOf(MockCouch);
  });

  describe('#create', () => {

    let adapter;

    beforeEach(() => {
      adapter = new Adapter(kudu, {
        host: 'http://127.0.0.1',
        port: 5984,
        path: '/test',
      });
    });

    it('should throw if not passed a Kudu model instance', () => {
      let test = () => adapter.create();
      expect(test).to.throw(Error, /model instance/);
    });

    it('should return the instance it is passed', () => {
      let instance = new MockModel();
      return expect(adapter.create(instance)).to.eventually.equal(instance);
    });

    it('should add an "id" property to the instance', () => {
      let instance = new MockModel();
      return adapter.create(instance)
      .then(() => expect(instance).to.have.property('id', '1'));
    });

    it('should add a "_rev" property to the instance', () => {
      let instance = new MockModel();
      return adapter.create(instance)
      .then(() => expect(instance).to.have.property('_rev', '1'));
    });

    it('should persist linked documents as references by unique identifier', () => {
      let linked = new MockModel({ id: '1' });
      let instance = new MockModel({ linked });
      return expect(adapter.create(instance)).to.eventually.equal(instance);
    });
  });

  describe('#get', () => {

    let adapter;

    beforeEach(() => {
      adapter = new Adapter(kudu, {
        host: 'http://127.0.0.1',
        port: 5984,
        path: '/test',
      });
    });

    it('should throw if not passed a type', () => {
      let test = () => adapter.get();
      expect(test).to.throw(Error, /model type/);
    });

    it('should throw if not passed an identifier', () => {
      let test = () => adapter.get('type');
      expect(test).to.throw(Error, /identifier/);
    });

    it('should return the CouchDB document', () => {
      return expect(adapter.get('type', '1')).to.become({ id: '1', _rev: '1' });
    });

    it('should return an array of documents if "ids" was an array', () => {
      return expect(adapter.get('type', [ '1' ])).to.become({ rows: [ { id: '1', _rev: '1' } ] });
    });
  });

  describe('#getAll', () => {

    let adapter;

    beforeEach(() => {
      adapter = new Adapter(kudu, {
        host: 'http://127.0.0.1',
        port: 5984,
        path: '/test',
      });
    });

    it('should throw if not passed a type', () => {
      let test = () => adapter.getAll();
      expect(test).to.throw(Error, /model type/);
    });

    it('should throw if a "type" view is not configured', () => {
      let adapter = new Adapter(kudu, {
        host: 'http://127.0.0.1',
        port: 5984,
        path: '/test',
        views: {
          type: {},
        },
      });
      let test = () => adapter.getAll('type');
      expect(test).to.throw(Error, /view/);
    });

    it('should return an array of CouchDB documents', () => {
      return expect(adapter.getAll('type')).to.become({
        rows: [
          { id: '1', _rev: '1' },
          { id: '2', _rev: '1' },
        ],
      });
    });
  });

  describe('#getRelated', () => {

    let adapter;

    beforeEach(() => {
      adapter = new Adapter(kudu, {
        host: 'http://127.0.0.1',
        port: 5984,
        path: '/test',
      });
    });

    it('should throw if not passed all required parameters', () => {
      let test = () => adapter.getRelated();
      expect(test).to.throw(Error, /ancestor/);
    });

    it('should throw if a "related" view is not configured', () => {
      let adapter = new Adapter(kudu, {
        host: 'http://127.0.0.1',
        port: 5984,
        path: '/test',
        views: {
          related: {},
        },
      });
      let test = () => adapter.getRelated('ancestor', '1', 'type');
      expect(test).to.throw(Error, /view/);
    });

    it('should return the related document', () => {
      return expect(adapter.getRelated('ancestor', '1', 'type')).to.become({ id: '1', _rev: '1' });
    });
  });

  describe('#update', () => {

    let adapter;

    beforeEach(() => {
      adapter = new Adapter(kudu, {
        host: 'http://127.0.0.1',
        port: 5984,
        path: '/test',
      });
    });

    it('should throw if not passed a Kudu model instance', () => {
      let test = () => adapter.update();
      expect(test).to.throw(Error, /model instance/);
    });

    it('should return the instance it is passed', () => {
      let instance = new MockModel({ id: '1', _rev: '1' });
      return expect(adapter.update(instance)).to.eventually.equal(instance);
    });

    it('should not modify the instance it is passed', () => {
      let instance = new MockModel({ id: '1', _rev: '1' });
      return expect(adapter.update(instance)).to.eventually.not.have.property('_id');
    });

    it('should update the "_rev" property on the instance', () => {
      let instance = new MockModel({ id: '1', _rev: '1' });
      return adapter.update(instance)
      .then(() => expect(instance).to.have.property('_rev', '2'));
    });

    it('should persist linked documents as references by unique identifier', () => {
      let linked = new MockModel({ id: '1' });
      let instance = new MockModel({ id: '2', _rev: '1', linked });
      return expect(adapter.update(instance)).to.eventually.equal(instance);
    });
  });

  describe('#getFromView', () => {

    let adapter;

    beforeEach(() => {
      adapter = new Adapter(kudu, {
        host: 'http://127.0.0.1',
        port: 5984,
        path: '/test',
      });
    });

    it('should throw an error if not passed a design document identifier', () => {
      let test = () => adapter.getFromView();
      expect(test).to.throw(Error, /design document/);
    });

    it('should throw an error if not passed a view identifier', () => {
      let test = () => adapter.getFromView('design');
      expect(test).to.throw(Error, /view/);
    });

    it('should return an array of CouchDB documents', () => {
      return expect(adapter.getFromView('design', 'view')).to.become([
        { id: '1', _rev: '1' },
        { id: '2', _rev: '1' },
      ]);
    });
  });
});
