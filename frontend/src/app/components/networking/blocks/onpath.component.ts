import { Component, OnInit, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { LessonWork } from '../lesson-work.service';
import { ATTACKER, GATEWAY, MISSIONS, OnpathAction, OnpathState, START, VICTIM, act } from './onpath';

/** Be the attacker on a switched LAN: poison ARP caches, forward traffic, strip TLS, then meet the defences. */
@Component({
  selector: 'app-onpath',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <section class="w" aria-label="On-path lab">
      <header class="head">
        <div class="title"><mat-icon aria-hidden="true">swap_calls</mat-icon> On-path lab: ARP poisoning</div>
        <div class="count" aria-live="polite">{{ s.done.length }} of {{ missions.length }} missions</div>
      </header>
      <p class="intro">You are the attacker at 10.0.0.66, plugged into the same switch as the victim. Use the buttons to send forged ARP replies, then make the victim sign in to three sites and see what you capture.</p>

      <ol class="missions">
        @for (m of missions; track m.id) {
          <li [class.done]="s.done.includes(m.id)"><mat-icon aria-hidden="true">{{ s.done.includes(m.id) ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon> {{ m.text }}</li>
        }
      </ol>

      <div class="lan" aria-label="The network">
        <div class="node victim">
          <div class="n-h"><mat-icon aria-hidden="true">computer</mat-icon> Victim</div>
          <div class="mono small">{{ victim.ip }} · {{ victim.mac }}</div>
          <div class="cache"><div class="c-h">ARP cache</div>
            <div class="mono" [class.forged]="s.victimPoisoned">{{ gateway.ip }} → {{ s.victimPoisoned ? attacker.mac : gateway.mac }}</div></div>
        </div>
        <div class="path" aria-live="polite">
          <div class="p-row"><span class="lbl">Out</span> <span class="mono">{{ s.victimPoisoned ? 'victim → ATTACKER → gateway' : 'victim → gateway' }}</span></div>
          <div class="p-row"><span class="lbl">Back</span> <span class="mono">{{ s.gatewayPoisoned ? 'gateway → ATTACKER → victim' : 'gateway → victim' }}</span></div>
          <div class="switch"><mat-icon aria-hidden="true">device_hub</mat-icon> Switch @if (s.dai) { <span class="tag good">DAI on</span> }</div>
        </div>
        <div class="node gateway">
          <div class="n-h"><mat-icon aria-hidden="true">router</mat-icon> Gateway</div>
          <div class="mono small">{{ gateway.ip }} · {{ gateway.mac }}</div>
          <div class="cache"><div class="c-h">ARP cache</div>
            <div class="mono" [class.forged]="s.gatewayPoisoned">{{ victim.ip }} → {{ s.gatewayPoisoned ? attacker.mac : victim.mac }}</div></div>
        </div>
      </div>

      <div class="consoles">
        <div class="console attacker">
          <div class="c-title"><mat-icon aria-hidden="true">visibility</mat-icon> Attacker <span class="mono small">{{ attacker.ip }} · {{ attacker.mac }}</span></div>
          <div class="btns">
            <button type="button" class="btn" (click)="go('poison-victim')">Poison the victim</button>
            <button type="button" class="btn" (click)="go('poison-gateway')">Poison the gateway</button>
            <button type="button" class="btn" [class.lit]="s.forwarding" [attr.aria-pressed]="s.forwarding" (click)="go('forward')">IP forwarding: {{ s.forwarding ? 'on' : 'off' }}</button>
            <button type="button" class="btn" [class.lit]="s.stripping" [attr.aria-pressed]="s.stripping" (click)="go('strip')">SSL stripping: {{ s.stripping ? 'on' : 'off' }}</button>
            <button type="button" class="btn ghost" (click)="go('heal')">Stop poisoning</button>
          </div>
        </div>
        <div class="console">
          <div class="c-title"><mat-icon aria-hidden="true">person</mat-icon> Make the victim sign in to</div>
          <div class="btns">
            <button type="button" class="btn" (click)="go('intranet')"><mat-icon aria-hidden="true">lock_open</mat-icon> Intranet (HTTP)</button>
            <button type="button" class="btn" (click)="go('shop')"><mat-icon aria-hidden="true">lock</mat-icon> Shop (HTTPS)</button>
            <button type="button" class="btn" (click)="go('bank')"><mat-icon aria-hidden="true">verified_user</mat-icon> Bank (HTTPS + HSTS)</button>
          </div>
          <div class="c-title second"><mat-icon aria-hidden="true">shield</mat-icon> Defender</div>
          <div class="btns">
            <button type="button" class="btn" [class.lit]="s.dai" [attr.aria-pressed]="s.dai" (click)="go('dai')">Dynamic ARP Inspection: {{ s.dai ? 'on' : 'off' }}</button>
          </div>
        </div>
      </div>

      <div class="log-h"><span>What happened</span><span class="spacer"></span>
        @if (s.log.length) { <button type="button" class="btn ghost" (click)="clear()">Clear log</button> }
        @if (s.done.length) { <button type="button" class="btn ghost" (click)="reset()">Start over</button> }
      </div>
      <ol class="log" aria-live="polite">
        @if (!s.log.length) { <li class="empty">Nothing yet. Start by making the victim sign in to the intranet before you poison anything.</li> }
        @for (l of recent; track $index) {
          <li [class]="'ln ' + l.who + ' ' + l.tone"><span class="who">{{ who[l.who] }}</span><span [class.mono]="l.who === 'capture'">{{ l.text }}</span></li>
        }
      </ol>

      @if (s.done.length === missions.length) {
        <div class="result" role="status"><mat-icon aria-hidden="true">emoji_events</mat-icon>
          <span><strong>All six.</strong> ARP has no authentication, so anyone on the subnet can claim any address. Encryption with HSTS keeps on-path attackers from reading anything, and DAI stops the poisoning itself.</span>
        </div>
      }
    </section>
  `,
  styleUrl: './onpath.component.scss',
})
export class OnpathComponent implements OnInit {
  private work = inject(LessonWork, { optional: true });
  readonly missions = MISSIONS;
  readonly victim = VICTIM;
  readonly gateway = GATEWAY;
  readonly attacker = ATTACKER;
  readonly who: Record<string, string> = { attacker: 'Attacker', victim: 'Victim', switch: 'Switch', capture: 'Captured' };
  s: OnpathState = START;

  ngOnInit() {
    const saved = this.work?.get<OnpathState>('onpath');
    if (saved) this.s = { ...START, ...saved, log: Array.isArray(saved.log) ? saved.log : [], done: (saved.done ?? []).filter(id => MISSIONS.some(m => m.id === id)) };
  }

  /** Newest first, so the result of a click is always at the top. */
  get recent() { return [...this.s.log].reverse().slice(0, 14); }

  go(a: OnpathAction) { this.s = act(this.s, a); this.save(); }
  clear() { this.s = { ...this.s, log: [] }; this.save(); }
  reset() { this.s = START; this.work?.clear('onpath'); }
  private save() { this.work?.set('onpath', this.s); }
}
