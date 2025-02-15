import { loggerSpy } from '../testhelpers/loggerSpy';
import { FSHImporter, RawFSH } from '../../src/import';

describe('FSHImporter', () => {
  beforeEach(() => {
    loggerSpy.reset();
  });

  describe('ParamRuleSet', () => {
    it('should parse a ParamRuleSet with a rule', () => {
      const importer = new FSHImporter();
      const input = `
        RuleSet: MyRuleSet (system, strength)
        * code from {system} {strength}
        * pig from egg
      `;

      importer.import([new RawFSH(input, 'Params.fsh')]);
      expect(loggerSpy.getAllMessages('warn')).toHaveLength(0);
      expect(loggerSpy.getAllMessages('error')).toHaveLength(0);
      expect(importer.paramRuleSets.size).toBe(1);
      expect(importer.paramRuleSets.has('MyRuleSet')).toBe(true);
      const result = importer.paramRuleSets.get('MyRuleSet');
      expect(result.name).toBe('MyRuleSet');
      expect(result.parameters).toEqual(['system', 'strength']);
      const expectedContents = `
        * code from {system} {strength}
        * pig from egg`;
      expect(result.contents).toBe(expectedContents);
    });

    it('should parse a ParamRuleSet with a numeric name', () => {
      const importer = new FSHImporter();
      const input = `
        RuleSet: 123 (system, strength)
        * code from {system} {strength}
      `;

      importer.import([new RawFSH(input, 'Params.fsh')]);
      expect(importer.paramRuleSets.size).toBe(1);
      expect(importer.paramRuleSets.has('123')).toBe(true);
      const result = importer.paramRuleSets.get('123');
      expect(result.name).toBe('123');
      expect(result.parameters).toEqual(['system', 'strength']);
    });

    it('should parse a ParamRuleSet when there is no space between the ruleset name and parameter list', () => {
      const importer = new FSHImporter();
      const input = `
        RuleSet: MyRuleSet(system, strength)
        * code from {system} {strength}
        * pig from egg
      `;

      importer.import([new RawFSH(input, 'Params.fsh')]);
      expect(loggerSpy.getAllMessages('warn')).toHaveLength(0);
      expect(loggerSpy.getAllMessages('error')).toHaveLength(0);
      expect(importer.paramRuleSets.size).toBe(1);
      expect(importer.paramRuleSets.has('MyRuleSet')).toBe(true);
      const result = importer.paramRuleSets.get('MyRuleSet');
      expect(result.name).toBe('MyRuleSet');
      expect(result.parameters).toEqual(['system', 'strength']);
      const expectedContents = `
        * code from {system} {strength}
        * pig from egg`;
      expect(result.contents).toBe(expectedContents);
    });

    it('should stop parsing ParamRuleSet contents when the next entity is defined', () => {
      const importer = new FSHImporter();
      const input = `
        RuleSet: MyRuleSet (system, strength)
        * code from http://example.org/{system}/info.html {strength}
        * pig from egg

        Profile: MyObservation
        Parent: Observation
      `;

      const docs = importer.import([new RawFSH(input, 'Params.fsh')]);
      expect(loggerSpy.getAllMessages('warn')).toHaveLength(0);
      expect(loggerSpy.getAllMessages('error')).toHaveLength(0);
      expect(docs).toHaveLength(1);
      expect(docs[0].profiles.has('MyObservation')).toBe(true);
      expect(importer.paramRuleSets.size).toBe(1);
      expect(importer.paramRuleSets.has('MyRuleSet')).toBe(true);
      const result = importer.paramRuleSets.get('MyRuleSet');
      expect(result.name).toBe('MyRuleSet');
      expect(result.parameters).toEqual(['system', 'strength']);
      const expectedContents = `
        * code from http://example.org/{system}/info.html {strength}
        * pig from egg`;
      expect(result.contents).toBe(expectedContents);
    });

    it('should log an error and skip the ParamRuleSet when encountering a ParamRuleSet with a name used by another ParamRuleSet', () => {
      const importer = new FSHImporter();
      const input = `
        RuleSet: MyRuleSet (system, strength)
        * code from http://example.org/{system}/info.html {strength}
        * pig from egg

        RuleSet: MyRuleSet (someName)
        * name = "Dr. {someName}"
      `;

      importer.import([new RawFSH(input, 'Params.fsh')]);
      expect(loggerSpy.getAllMessages('warn')).toHaveLength(0);
      expect(loggerSpy.getAllMessages('error')).toHaveLength(1);
      expect(importer.paramRuleSets.size).toBe(1);
      expect(importer.paramRuleSets.has('MyRuleSet')).toBe(true);
      const result = importer.paramRuleSets.get('MyRuleSet');
      expect(result.name).toBe('MyRuleSet');
      expect(result.parameters).toEqual(['system', 'strength']);
      const expectedContents = `
        * code from http://example.org/{system}/info.html {strength}
        * pig from egg`;
      expect(result.contents).toBe(expectedContents);
      expect(loggerSpy.getLastMessage('error')).toMatch(/RuleSet named MyRuleSet already exists/s);
      expect(loggerSpy.getLastMessage('error')).toMatch(/File: Params\.fsh.*Line: 6 - 7/s);
    });

    it('should log an error and skip the ParamRuleSet when encountering an ParamRuleSet with a name used by another ParamRuleSet in another file', () => {
      const importer = new FSHImporter();
      const input1 = `
        RuleSet: MyRuleSet (system, strength)
        * code from http://example.org/{system}/info.html {strength}
        * pig from egg
      `;

      const input2 = `
        RuleSet: MyRuleSet (someName)
        * name = "Dr. {someName}"
      `;

      importer.import([new RawFSH(input1, 'File1.fsh'), new RawFSH(input2, 'File2.fsh')]);
      expect(loggerSpy.getAllMessages('warn')).toHaveLength(0);
      expect(loggerSpy.getAllMessages('error')).toHaveLength(1);
      expect(importer.paramRuleSets.size).toBe(1);
      expect(importer.paramRuleSets.size).toBe(1);
      expect(importer.paramRuleSets.has('MyRuleSet')).toBe(true);
      const result = importer.paramRuleSets.get('MyRuleSet');
      expect(result.name).toBe('MyRuleSet');
      expect(result.parameters).toEqual(['system', 'strength']);
      const expectedContents = `
        * code from http://example.org/{system}/info.html {strength}
        * pig from egg`;
      expect(result.contents).toBe(expectedContents);
      expect(loggerSpy.getLastMessage('error')).toMatch(/RuleSet named MyRuleSet already exists/s);
      expect(loggerSpy.getLastMessage('error')).toMatch(/File: File2\.fsh.*Line: 2 - 3/s);
    });

    it('should log a warning when a ParamRuleSet has parameters that are not used in the contents', () => {
      const importer = new FSHImporter();
      const input = `
        RuleSet: MyRuleSet (system, something, strength, extra)
        * code from http://example.org/{system}/info.html {strength}
        * pig from egg
      `;

      importer.import([new RawFSH(input, 'Params.fsh')]);
      expect(loggerSpy.getAllMessages('warn')).toHaveLength(1);
      expect(loggerSpy.getAllMessages('error')).toHaveLength(0);
      expect(loggerSpy.getLastMessage('warn')).toMatch(
        /RuleSet MyRuleSet contains unused parameters: something, extra/s
      );
      expect(loggerSpy.getLastMessage('warn')).toMatch(/File: Params\.fsh.*Line: 2 - 4/s);
    });
  });
});
