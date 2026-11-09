import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatchQuestion } from '../../models/exam.model';
import { MatchBoardComponent } from './match-board.component';

const why = 'because this explanation is long enough';
const board: MatchQuestion = {
  id: 'm', domain: 4, objective: '4.9', kind: 'match', stem: 'Match them', takeaway: why, choices: ['Alpha', 'Beta', 'Gamma'],
  prompts: [{ label: 'one', answer: 'Alpha', why }, { label: 'two', answer: 'Beta', why }, { label: 'three', answer: 'Alpha', why }],
};
const form: MatchQuestion = {
  ...board, choices: undefined,
  prompts: [{ label: 'one', answer: 'A', why, choices: ['A', 'B'] }, { label: 'two', answer: 'C', why, choices: ['C', 'D'] }],
};

describe('MatchBoardComponent', () => {
  let fixture: ComponentFixture<MatchBoardComponent>;
  let got: { index: number; value: string }[];

  function create(question: MatchQuestion, picks: string[] = [], disabled = false) {
    fixture = TestBed.createComponent(MatchBoardComponent);
    fixture.componentRef.setInput('question', question);
    fixture.componentRef.setInput('picks', picks);
    fixture.componentRef.setInput('disabled', disabled);
    got = [];
    fixture.componentInstance.picked.subscribe(e => got.push(e));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [MatchBoardComponent] }));

  it('places a tapped answer on the tapped slot, then forgets it', () => {
    const el = create(board);
    (el.querySelectorAll('.chip')[1] as HTMLElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.chip.selected')?.textContent).toContain('Beta');
    (el.querySelectorAll('.slot-btn')[2] as HTMLElement).click();
    fixture.detectChanges();
    expect(got).toEqual([{ index: 2, value: 'Beta' }]);
    expect(el.querySelector('.chip.selected')).toBeNull();
  });

  it('keeps used answers in the bank, so a board never hints that one is used up', () => {
    const el = create(board, ['Alpha']);
    expect(el.querySelectorAll('.chip').length).toBe(3);
    expect(el.querySelector('.chip.used')?.textContent).toContain('Alpha');
  });

  it('removes a placed answer', () => {
    const el = create(board, ['Alpha']);
    (el.querySelector('.clear') as HTMLElement).click();
    expect(got).toEqual([{ index: 0, value: '' }]);
  });

  it('does nothing once locked', () => {
    const el = create(board, ['Alpha'], true);
    expect(el.querySelector('.clear')).toBeNull();
    expect(el.querySelector('.hint')).toBeNull();
    expect((el.querySelector('.chip') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('keeps a dropdown for prompts with their own answers', () => {
    const el = create(form);
    expect(el.querySelectorAll('select').length).toBe(2);
    expect(el.querySelector('.bank')).toBeNull();
    const select = el.querySelector('select') as HTMLSelectElement;
    select.value = 'B';
    select.dispatchEvent(new Event('change'));
    expect(got).toEqual([{ index: 0, value: 'B' }]);
  });
});
