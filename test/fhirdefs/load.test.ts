import { loadFromPath, loadDependency } from '../../src/fhirdefs/load';
import { FHIRDefinitions } from '../../src/fhirdefs/FHIRDefinitions';
import { Type } from '../../src/utils';
import { TestFisher } from '../testhelpers';
import path from 'path';
import fs from 'fs-extra';
import tar from 'tar';
import rp from 'request-promise-native';

describe('#loadFromPath()', () => {
  let defs: FHIRDefinitions;
  beforeAll(() => {
    defs = new FHIRDefinitions();
    loadFromPath(
      path.join(__dirname, '..', 'testhelpers', 'testdefs', 'package'),
      'test#1.1.1',
      defs
    );
    // Run the dependency resources through TestFisher to force them into the testhelpers cache
    const fisher = new TestFisher().withFHIR(defs);
    fisher.fishForFHIR('Condition');
    fisher.fishForFHIR('boolean');
    fisher.fishForFHIR('Address');
    fisher.fishForFHIR('vitalsigns');
    fisher.fishForFHIR('patient-mothersMaidenName');
    fisher.fishForFHIR('allergyintolerance-clinical', Type.ValueSet);
    fisher.fishForFHIR('allergyintolerance-clinical', Type.CodeSystem);
  });

  it('should load base FHIR resources', () => {
    expect(defs.allResources().some(r => r.id === 'Condition')).toBeTruthy();
  });

  it('should load base FHIR primitive types', () => {
    expect(defs.allTypes().some(r => r.id === 'boolean')).toBeTruthy();
  });

  it('should load base FHIR complex types', () => {
    expect(defs.allTypes().some(r => r.id === 'Address')).toBeTruthy();
  });

  it('should load base FHIR profiles', () => {
    expect(defs.allProfiles().some(r => r.id === 'vitalsigns')).toBeTruthy();
  });

  it('should load base FHIR extensions', () => {
    expect(defs.allExtensions().some(r => r.id === 'patient-mothersMaidenName')).toBeTruthy();
  });

  it('should load base FHIR value sets', () => {
    expect(defs.allValueSets().some(r => r.id === 'allergyintolerance-clinical')).toBeTruthy();
  });

  it('should load base FHIR code sytems', () => {
    expect(defs.allCodeSystems().some(r => r.id === 'allergyintolerance-clinical')).toBeTruthy();
  });
});

describe('#loadDependency()', () => {
  let defs: FHIRDefinitions;
  let requestSpy: jest.SpyInstance;
  let tarSpy: jest.SpyInstance;
  let ensureDirSpy: jest.SpyInstance;
  let writeSpy: jest.SpyInstance;
  beforeAll(() => {
    defs = new FHIRDefinitions();
    requestSpy = jest.spyOn(rp, 'get').mockImplementation((options: any): any => {
      if (options.uri === 'http://build.fhir.org/ig/qas.json') {
        return [
          {
            url: 'http://hl7.org/fhir/hspc/ImplementationGuide/hspc',
            name: 'HSPC Implementation Guide',
            'package-id': 'hl7.fhir.hspc',
            'ig-ver': '1.0',
            date: 'Thu, 11 Oct, 2018 11:00:14 -0600',
            errs: 34,
            warnings: 10,
            hints: 0,
            version: '3.0.1',
            tool: '3.4.0-13844',
            repo: 'nrdavis1/HSPCFHIRtest/bran'
          },
          {
            url: 'http://hl7.org/fhir/hspc/ImplementationGuide/hspc',
            name: 'HSPC Implementation Guide',
            'package-id': 'hl7.fhir.hspc',
            'ig-ver': '1.0',
            date: 'Tue, 05 Mar, 2019 12:02:14 -0700',
            errs: 26980,
            warnings: 10,
            hints: 0,
            version: '3.0.1',
            tool: '3.4.0-13844',
            repo: 'nrdavis1/HSPCFHIRtest/branches'
          }
        ];
      } else {
        return {};
      }
    });
    tarSpy = jest.spyOn(tar, 'x').mockImplementation(() => {});
    writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    ensureDirSpy = jest.spyOn(fs, 'ensureDirSync').mockImplementation(() => {});
  });

  beforeEach(() => {
    requestSpy.mockClear();
    tarSpy.mockClear();
    writeSpy.mockClear();
    ensureDirSpy.mockClear();
  });

  it('should not try to download a package that is already in the cache', async () => {
    defs = new FHIRDefinitions();
    loadFromPath(
      path.join(__dirname, '..', 'testhelpers', 'testdefs', 'package'),
      'test#1.1.1',
      defs
    );
    await expect(
      loadDependency(
        'test',
        '1.1.1',
        defs,
        path.join(__dirname, '..', 'testhelpers', 'testdefs', 'package')
      )
    ).resolves.toEqual(defs);
    expect(requestSpy.mock.calls.length).toBe(0);
  });

  it('should try to load a package from packages.fhir.org when a non-special package version is loaded', async () => {
    await expect(loadDependency('hl7.fhir.hspc', '1.1.1', defs, 'foo')).rejects.toThrow(
      'The package hl7.fhir.hspc#1.1.1 could not be loaded locally or from the FHIR package registry'
    );
    expect(requestSpy.mock.calls[0][0].uri).toBe('http://packages.fhir.org/hl7.fhir.hspc/1.1.1');
    expect(ensureDirSpy.mock.calls[0]).toEqual([path.join('foo', 'hl7.fhir.hspc#1.1.1')]);
    expect(tarSpy.mock.calls[0][0].cwd).toBe(path.join('foo', 'hl7.fhir.hspc#1.1.1'));
  });

  it('should try to load the latest package from build.fhir.org when a current package version is loaded', async () => {
    await expect(loadDependency('hl7.fhir.hspc', 'current', defs, 'foo')).rejects.toThrow(
      'The package hl7.fhir.hspc#current could not be loaded locally or from the FHIR package registry'
    );
    expect(requestSpy.mock.calls[0]).toEqual([
      {
        json: true,
        uri: 'http://build.fhir.org/ig/qas.json'
      }
    ]);
    expect(requestSpy.mock.calls[1][0].uri).toBe(
      'http://build.fhir.org/ig/nrdavis1/HSPCFHIRtest/branches/package.tgz'
    );
    expect(ensureDirSpy.mock.calls[0]).toEqual([path.join('foo', 'hl7.fhir.hspc#current')]);
    expect(tarSpy.mock.calls[0][0].cwd).toBe(path.join('foo', 'hl7.fhir.hspc#current'));
  });

  it('should throw CurrentPackageLoadError when a current package is not listed', async () => {
    await expect(loadDependency('hl7.fhir.us.core', 'current', defs, 'foo')).rejects.toThrow(
      'The package hl7.fhir.us.core#current is not available on http://build.fhir.org/ig/qas.json, so no current version can be loaded'
    );
    expect(requestSpy.mock.calls.length).toBe(1);
    expect(requestSpy.mock.calls[0]).toEqual([
      {
        json: true,
        uri: 'http://build.fhir.org/ig/qas.json'
      }
    ]);
  });

  it('should throw CurrentPackageLoadError when http://build.fhir.org/ig/qas.json gives a bad response', async () => {
    requestSpy.mockImplementationOnce(() => {});
    await expect(loadDependency('bad.response', 'current', defs, 'foo')).rejects.toThrow(
      'The package bad.response#current is not available on http://build.fhir.org/ig/qas.json, so no current version can be loaded'
    );
    expect(requestSpy.mock.calls.length).toBe(1);
    expect(requestSpy.mock.calls[0]).toEqual([
      {
        json: true,
        uri: 'http://build.fhir.org/ig/qas.json'
      }
    ]);
  });

  it('should throw DevPackageLoadError when a dev package version is not locally present', async () => {
    await expect(loadDependency('test', 'dev', defs, 'somePath')).rejects.toThrow(
      'The package test#dev could not be loaded locally. Dev packages must be present in local cache'
    );
  });
});
