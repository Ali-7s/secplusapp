import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute } from '@angular/router';
import { SectionStudyComponent } from './section-study.component';
import { Question } from '../../models/question.model';

/**
 * Tests the client-side PBQ grading logic. We construct the component but never call
 * detectChanges, so ngOnInit (and its HTTP calls) never fire — we just exercise methods.
 */
describe('SectionStudyComponent — PBQ grading', () => {
  let comp: SectionStudyComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SectionStudyComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => '1.1' }, queryParamMap: { get: () => null } } },
        },
      ],
    });
    comp = TestBed.createComponent(SectionStudyComponent).componentInstance;
  });

  function firewallQ(): Question {
    return {
      id: 'fw1', sectionId: '1.1', domainId: 'd1', type: 'FIREWALL_RULES', stem: '',
      options: [], correctAnswer: '', explanation: '', difficulty: 'Hard', tags: [], points: 1,
      firewallColumns: ['Source', 'Service', 'Action'],
      firewallOptions: { Source: ['Any'], Service: ['HTTPS (443)', 'Any'], Action: ['Allow', 'Deny'] },
      correctRules: [
        { Source: 'Any', Service: 'HTTPS (443)', Action: 'Allow' },
        { Source: 'Any', Service: 'Any', Action: 'Deny' },
      ],
    } as Question;
  }

  function fillRow(qId: string, row: number, values: string[]) {
    values.forEach((v, c) => comp.fwSet(qId, row, c, v));
  }

  it('fwAllFilled is false until every cell is set', () => {
    const q = firewallQ();
    expect(comp.fwAllFilled(q)).toBeFalse();
    fillRow(q.id, 0, ['Any', 'HTTPS (443)', 'Allow']);
    expect(comp.fwAllFilled(q)).toBeFalse();
    fillRow(q.id, 1, ['Any', 'Any', 'Deny']);
    expect(comp.fwAllFilled(q)).toBeTrue();
  });

  it('grades a perfect ruleset correct (case-insensitive)', () => {
    const q = firewallQ();
    fillRow(q.id, 0, ['Any', 'HTTPS (443)', 'Allow']);
    fillRow(q.id, 1, ['any', 'any', 'deny']);
    expect(comp.isPracticeCorrect(q)).toBeTrue();
  });

  it('pinpoints the wrong cell and fails the question', () => {
    const q = firewallQ();
    fillRow(q.id, 0, ['Any', 'HTTPS (443)', 'Allow']);
    fillRow(q.id, 1, ['Any', 'Any', 'Allow']); // last action should be Deny
    expect(comp.fwRowCorrect(q, 0)).toBeTrue();
    expect(comp.fwRowCorrect(q, 1)).toBeFalse();
    expect(comp.fwCellCorrect(q, 1, 2)).toBeFalse();
    expect(comp.isPracticeCorrect(q)).toBeFalse();
  });

  it('grades NETWORK_PLACEMENT via drag-drop pairs', () => {
    const q = {
      id: 'np1', sectionId: '1.1', domainId: 'd1', type: 'NETWORK_PLACEMENT', stem: '',
      options: [], correctAnswer: '', explanation: '', difficulty: 'Medium', tags: [], points: 1,
      dragPairs: [{ id: 'fw', label: 'Firewall' }, { id: 'ids', label: 'IDS' }],
      correctPairs: { fw: 'edge', ids: 'mon' },
    } as Question;
    expect(comp.isPracticeCorrect(q)).toBeFalse();
    comp.ddMatches['np1'] = { fw: 'edge', ids: 'mon' };
    expect(comp.isPracticeCorrect(q)).toBeTrue();
    comp.ddMatches['np1'] = { fw: 'mon', ids: 'edge' };
    expect(comp.isPracticeCorrect(q)).toBeFalse();
  });

  it('isPbq recognizes every PBQ type', () => {
    const types: Question['type'][] = ['DRAG_DROP', 'ORDER_LIST', 'FIREWALL_RULES', 'NETWORK_PLACEMENT', 'LOG_ANALYSIS', 'CONFIG_FORM'];
    types.forEach(t => expect(comp.isPbq({ type: t } as Question)).withContext(t).toBeTrue());
    expect(comp.isPbq({ type: 'MULTIPLE_CHOICE' } as Question)).toBeFalse();
  });

  it('grades CONFIG_FORM per field (case-insensitive, all-filled gate)', () => {
    const q = {
      id: 'cf1', sectionId: '1.1', domainId: 'd1', type: 'CONFIG_FORM', stem: '',
      options: [], correctAnswer: '', explanation: '', difficulty: 'Hard', tags: [], points: 1,
      configFields: [
        { group: 'Gateway A — Phase 1', label: 'Encryption', options: ['DES', 'AES-256'], correct: 'AES-256' },
        { label: 'SRV-01', options: ['Infection source', 'Infected', 'Clean'], correct: 'Clean' },
      ],
    } as Question;

    expect(comp.cfAllFilled(q)).toBeFalse();
    expect(comp.isPracticeCorrect(q)).toBeFalse();

    comp.cfSet(q.id, 0, 'aes-256');            // case-insensitive
    comp.cfSet(q.id, 1, 'Clean');
    expect(comp.cfAllFilled(q)).toBeTrue();
    expect(comp.isPracticeCorrect(q)).toBeTrue();

    comp.cfSet(q.id, 1, 'Infected');           // one wrong field fails the question
    expect(comp.cfFieldCorrect(q, 0)).toBeTrue();
    expect(comp.cfFieldCorrect(q, 1)).toBeFalse();
    expect(comp.isPracticeCorrect(q)).toBeFalse();

    // group header renders once at the first field of a group
    expect(comp.cfNewGroup(q, 0)).toBeTrue();
    expect(comp.cfNewGroup(q, 1)).toBeFalse();
  });
});
