import { Component, OnInit, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LessonWork } from '../lesson-work.service';

export type PartKind = 'from' | 'reply' | 'subject' | 'auth' | 'line' | 'link' | 'file';

export interface MailPart {
  kind: PartKind;
  text: string;
  /** Where a link really goes, as hovering over it would show. */
  href?: string;
  /** Present when this part is a warning sign: why. */
  issue?: string;
  /** Present when this part is fine: why it is not a warning sign. */
  fine?: string;
}

export interface Mail {
  list: string;
  phish: boolean;
  /** What kind of attack, or why it is genuine, and what to do. */
  verdict: string;
  parts: MailPart[];
}

export const MAILS: Mail[] = [
  {
    list: 'Your mailbox will be deleted', phish: true,
    verdict: 'Credential phishing. The link leads to a fake sign-in page on a .ru domain that only starts with your company\'s name. Report it with the phishing button and do not click.',
    parts: [
      { kind: 'from', text: 'Contoso IT Helpdesk <helpdesk@c0ntoso-it.com>', issue: 'The display name looks like your own IT team, but the domain is c0ntoso-it.com, with a zero for the o. Look at the address, not the name.' },
      { kind: 'subject', text: 'ACTION REQUIRED: your mailbox will be deleted in 24 hours', issue: 'Urgency and a threat are there to rush you past thinking.' },
      { kind: 'line', text: 'Dear user,', issue: 'A generic greeting: your own IT team or a real service would use your name.' },
      { kind: 'line', text: 'We detected unusual sign-in activity and your mailbox storage is full. To avoid permanent deletion of all messages, verify your account now.', issue: 'Two unrelated scares at once, and the only way out is to "verify", which means typing your password into their page.' },
      { kind: 'link', text: 'Verify my account', href: 'http://login.contoso.com.verify-id.ru/sso', issue: 'The real address ends in verify-id.ru: everything before that is just a subdomain the attacker chose. It is also plain HTTP.' },
      { kind: 'line', text: 'Contoso IT · Keeping you connected', fine: 'Logos, signatures and footers are trivial to copy. They are not a warning sign, but they prove nothing either.' },
    ],
  },
  {
    list: 'Updated bank details for invoice 4471', phish: true,
    verdict: 'Business email compromise (invoice fraud). The supplier\'s real mailbox was taken over, so every check passes, but replies go to a lookalike domain and the money would go to the attacker. Call the supplier on the number you already have before changing any payment details.',
    parts: [
      { kind: 'from', text: 'Carlos Mendes <carlos.mendes@northwind-supply.com>', fine: 'This is the supplier\'s real address. The attacker has broken into Carlos\'s mailbox and is sending from it.' },
      { kind: 'reply', text: 'Reply-To: carlos.mendes@northwind-suppIy.com', issue: 'Replies go to a different domain: suppIy with a capital I instead of an l. The attacker wants your answers out of the real mailbox.' },
      { kind: 'auth', text: 'Authentication-Results: spf=pass dkim=pass dmarc=pass header.from=northwind-supply.com', fine: 'All three pass because the mail really came from the supplier\'s servers. Email authentication proves the domain, not the honesty of whoever is typing.' },
      { kind: 'subject', text: 'RE: Updated bank details for invoice 4471', fine: 'A reply to a real thread about a real invoice is normal. Attackers in a stolen mailbox reuse real threads, which is why the request matters more than the subject.' },
      { kind: 'line', text: 'Hi Priya, as discussed our bank has changed. Please pay invoice 4471 to the new account below instead of the usual one.', issue: 'A change of bank details by email is the classic sign of invoice fraud. It must be confirmed by phone on a known number.' },
      { kind: 'line', text: 'Please process it today. I\'m boarding a flight and can\'t take calls, so just reply here.', issue: 'Urgency plus a reason you cannot call to check. Both are there to stop you verifying.' },
      { kind: 'file', text: 'Invoice_4471.pdf (182 KB)', fine: 'A PDF invoice from a known supplier is ordinary. The danger here is the request, not the attachment.' },
    ],
  },
  {
    list: 'Delivery failed: reschedule your parcel', phish: true,
    verdict: 'Phishing with malware and a payment lure. The sender is spoofed (SPF and DMARC fail), the attachment is a program pretending to be a PDF, and the link collects card details. The domain owner\'s DMARC policy is p=none, which is why it was delivered at all.',
    parts: [
      { kind: 'from', text: 'Parcel Express <tracking@parcelexpress.com>', issue: 'It looks right, but the authentication line below shows the domain did not authorize the server that sent it: this From is forged.' },
      { kind: 'auth', text: 'Authentication-Results: spf=fail (198.51.100.77 not permitted) dkim=none dmarc=fail (p=none) header.from=parcelexpress.com', issue: 'SPF fails, there is no DKIM signature, and DMARC fails. With p=none the owner only asked for reports, so nothing stopped it.' },
      { kind: 'subject', text: 'Delivery failed: reschedule your parcel #8821', fine: 'Delivery notices are common and the wording is ordinary. On its own this is not a warning sign; the rest of the message is.' },
      { kind: 'line', text: 'We could not deliver your parcel. Pay the 1.99 EUR redelivery fee within 48 hours or it will be returned to the sender.', issue: 'A small fee is a lure to collect card details, and the deadline adds pressure.' },
      { kind: 'link', text: 'Pay 1.99 EUR and reschedule', href: 'https://parcelexpress-redelivery.top/pay', issue: 'The link goes to a different, newly made-looking domain. HTTPS only means the connection is encrypted, not that the site is honest.' },
      { kind: 'file', text: 'Shipping_Label_8821.pdf.exe (1.2 MB)', issue: 'A double extension: Windows hides the real one, so it looks like a PDF but is a program that runs when opened.' },
    ],
  },
  {
    list: 'Planned maintenance: VPN on Saturday', phish: false,
    verdict: 'Legitimate. It comes from your own domain and passes every check, asks for nothing, links to your own status page, and tells you how to check it independently.',
    parts: [
      { kind: 'from', text: 'IT Service Desk <servicedesk@contoso.com>', fine: 'Your company\'s own domain, spelled correctly, and the service desk\'s usual address.' },
      { kind: 'auth', text: 'Authentication-Results: spf=pass dkim=pass dmarc=pass header.from=contoso.com', fine: 'The mail really came from your company\'s mail system.' },
      { kind: 'subject', text: 'Planned maintenance: VPN unavailable Saturday 22:00 to 23:00', fine: 'Specific and calm, with a date and time, and no pressure to act.' },
      { kind: 'line', text: 'Hi Sam, the VPN will be down for upgrades on Saturday between 22:00 and 23:00. No action is needed from you.', fine: 'It uses your name and asks you to do nothing at all.' },
      { kind: 'link', text: 'See the status page', href: 'https://status.contoso.com/maintenance', fine: 'The real address is on your own company\'s domain, over HTTPS.' },
      { kind: 'line', text: 'We will never ask for your password by email. If in doubt, call the service desk on extension 4400.', fine: 'It gives you a way to check through a channel you already trust.' },
    ],
  },
];

const KIND_LABEL: Record<PartKind, string> = {
  from: 'From', reply: 'Reply-To', subject: 'Subject', auth: 'Header', line: 'Body', link: 'Link', file: 'Attachment',
};

interface MailWork { flags: number[]; verdict?: 'phish' | 'legit'; checked: boolean }

/**
 * An inbox of four messages. Tap every part that is a warning sign, decide phishing or legitimate, then check
 * to see the reason for each part.
 */
@Component({
  selector: 'app-email-inspector',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <section class="w" aria-label="Email inspector">
      <header class="head">
        <div class="title"><mat-icon aria-hidden="true">mark_email_unread</mat-icon> Inspect the inbox</div>
        <div class="count" aria-live="polite">{{ solvedCount }} of {{ mails.length }} judged right</div>
      </header>
      <p class="intro">Open each message. Tap every part that is a <strong>warning sign</strong>, decide whether it is phishing, then check. Links show the address they really go to, as hovering would on a computer.</p>

      <div class="inbox" role="tablist" aria-label="Messages">
        @for (m of mails; track $index) {
          <button type="button" role="tab" [attr.aria-selected]="active === $index" [class.on]="active === $index" [class.done]="work[$index].checked" (click)="open($index)">
            <mat-icon aria-hidden="true">{{ !work[$index].checked ? 'mail' : solved($index) ? 'check_circle' : 'error' }}</mat-icon>
            <span>{{ m.list }}</span>
          </button>
        }
      </div>

      <div class="mail" role="tabpanel">
        @for (part of mail.parts; track $index) {
          @let flagged = state.flags.includes($index);
          <button type="button" class="part" [attr.data-kind]="part.kind" [class.flag]="flagged" [attr.aria-pressed]="flagged"
            [class.hit]="state.checked && flagged && part.issue" [class.miss]="state.checked && !flagged && part.issue" [class.false]="state.checked && flagged && part.fine"
            (click)="toggle($index)">
            <span class="k">{{ kindLabel[part.kind] }}</span>
            <span class="t" [class.mono]="part.kind === 'auth' || part.kind === 'reply'">
              @if (part.kind === 'link') { <span class="ln">{{ part.text }}</span><span class="href mono">{{ part.href }}</span> }
              @else if (part.kind === 'file') { <mat-icon aria-hidden="true">attach_file</mat-icon> {{ part.text }} }
              @else { {{ part.text }} }
            </span>
            <mat-icon class="f" aria-hidden="true">{{ flagged ? 'flag' : 'outlined_flag' }}</mat-icon>
          </button>
          @if (state.checked && (flagged || part.issue)) {
            <div class="why" [class.good]="flagged === !!part.issue" [class.bad]="flagged !== !!part.issue">
              @if (part.issue) { <strong>{{ flagged ? 'Warning sign, well spotted.' : 'Missed warning sign.' }}</strong> {{ part.issue }} }
              @else { <strong>This one is fine.</strong> {{ part.fine }} }
            </div>
          }
        }
      </div>

      <div class="verdict" role="group" aria-label="Your verdict">
        <span>This message is</span>
        <button type="button" [class.on]="state.verdict === 'phish'" [attr.aria-pressed]="state.verdict === 'phish'" (click)="decide('phish')"><mat-icon aria-hidden="true">phishing</mat-icon> Phishing</button>
        <button type="button" [class.on]="state.verdict === 'legit'" [attr.aria-pressed]="state.verdict === 'legit'" (click)="decide('legit')"><mat-icon aria-hidden="true">verified</mat-icon> Legitimate</button>
      </div>
      @if (state.checked) {
        <div class="why" [class.good]="verdictRight" [class.bad]="!verdictRight">
          <strong>{{ verdictRight ? 'Right.' : 'Not quite.' }}</strong> {{ mail.verdict }}
        </div>
      }

      @if (solvedCount === mails.length) {
        <div class="result" role="status"><mat-icon aria-hidden="true">emoji_events</mat-icon>
          <span><strong>Inbox cleared.</strong> Check the real sender and reply address, where links really go, attachment types and the authentication results, and be most suspicious of urgency and requests to pay or sign in.</span></div>
      }
      <div class="controls">
        <button type="button" class="btn primary" [attr.aria-disabled]="!state.verdict" (click)="check()"><mat-icon aria-hidden="true">fact_check</mat-icon> Check</button>
        <span class="spacer"></span>
        <button type="button" class="btn ghost" (click)="reset()">Start over</button>
      </div>
    </section>
  `,
  styleUrl: './email-inspector.component.scss',
})
export class EmailInspectorComponent implements OnInit {
  private lessonWork = inject(LessonWork, { optional: true });
  readonly mails = MAILS;
  readonly kindLabel = KIND_LABEL;

  active = 0;
  work: MailWork[] = MAILS.map(() => ({ flags: [], checked: false }));

  ngOnInit() {
    const saved = this.lessonWork?.get<{ active: number; work: Partial<MailWork>[] }>('email');
    if (!saved) return;
    if (saved.active >= 0 && saved.active < MAILS.length) this.active = saved.active;
    this.work = MAILS.map((_, i) => ({ flags: [], checked: false, ...saved.work?.[i] }));
  }

  get mail() { return MAILS[this.active]; }
  get state() { return this.work[this.active]; }
  get verdictRight(): boolean { return (this.state.verdict === 'phish') === this.mail.phish; }

  /** Right verdict, every warning sign flagged and nothing fine flagged. */
  solved(i: number): boolean {
    const w = this.work[i], m = MAILS[i];
    return w.checked && (w.verdict === 'phish') === m.phish && m.parts.every((p, j) => w.flags.includes(j) === !!p.issue);
  }
  get solvedCount(): number { return MAILS.filter((_, i) => this.solved(i)).length; }

  open(i: number) { this.active = i; this.save(); }
  toggle(j: number) {
    const flags = this.state.flags.includes(j) ? this.state.flags.filter(f => f !== j) : [...this.state.flags, j];
    this.update({ flags, checked: false });
  }
  decide(verdict: 'phish' | 'legit') { this.update({ verdict, checked: false }); }
  check() { if (this.state.verdict) this.update({ checked: true }); }
  reset() {
    this.work = MAILS.map(() => ({ flags: [], checked: false }));
    this.active = 0;
    this.lessonWork?.clear('email');
  }
  private update(change: Partial<MailWork>) {
    this.work = this.work.map((w, i) => i === this.active ? { ...w, ...change } : w);
    this.save();
  }
  private save() { this.lessonWork?.set('email', { active: this.active, work: this.work }); }
}
