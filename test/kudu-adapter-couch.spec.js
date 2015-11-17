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
  get( id ) {

    return Promise.resolve({
      _id: '1',
      _rev: '1',
    });
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

class MockModel {
  toJSON() {
    return this;
  }
}

const Adapter = proxyquire('../src/kudu-adapter-couch', {
  'couch-promised': MockCouch,
});

chai.use(chaiAsPromised);
let expect = chai.expect;

describe('Kudu CouchDB adapter', () => {

  it('should throw if a host is not provided', () => {
    let test = () => new Adapter({
      port: 5984,
      path: '/test',
    });
    expect(test).to.throw(Error, /host/);
  });

  it('should throw if a port is not provided', () => {
    let test = () => new Adapter({
      host: 'http://127.0.0.1',
      path: '/test',
    });
    expect(test).to.throw(Error, /port/);
  });

  it('should throw if a path is not provided', () => {
    let test = () => new Adapter({
      host: 'http://127.0.0.1',
      port: 5984,
    });
    expect(test).to.throw(Error, /path/);
  });

  it('should expose the config object', () => {
    expect(new Adapter({
      host: 'http://127.0.0.1',
      port: 5984,
      path: '/test',
    })).to.have.property('config').that.is.an('object');
  });

  it('should allow a custom "document to model" function', () => {
    let documentToModel = () => {};
    expect(new Adapter({
      host: 'http://127.0.0.1',
      port: 5984,
      path: '/test',
      documentToModel,
    }).config).to.have.property('documentToModel', documentToModel);
  });

  it('should expose a default "view" config', () => {
    expect(new Adapter({
      host: 'http://127.0.0.1',
      port: 5984,
      path: '/test',
    }).config).to.have.property('views');
  });

  it('should expose a CouchDB interface', () => {
    expect(new Adapter({
      host: 'http://127.0.0.1',
      port: 5984,
      path: '/test',
    })).to.have.property('couch').that.is.an.instanceOf(MockCouch);
  });

  describe('#create', () => {

    let adapter;

    beforeEach(() => {
      adapter = new Adapter({
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
  });

  describe('#get', () => {

    let adapter;

    beforeEach(() => {
      adapter = new Adapter({
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
  });

  describe('#getAll', () => {

    let adapter;

    beforeEach(() => {
      adapter = new Adapter({
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
      let adapter = new Adapter({
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

  describe('#getFromView', () => {

    let adapter;

    beforeEach(() => {
      adapter = new Adapter({
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
