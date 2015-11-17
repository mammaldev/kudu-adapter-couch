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
});
