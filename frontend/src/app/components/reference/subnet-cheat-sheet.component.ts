import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CidrReaderComponent } from '../networking/blocks/cidr-reader.component';
import { ANSWER_FIELDS, SubnetAnswers, SubnetProblem, makeProblem, sameAnswer } from './subnet-practice';

/**
 * The Reference Sheet's subnetting tab: the prefix table, how to remember it, the method in five steps,
 * a worked example, the lesson's calculator, and a practice panel that generates problems to solve.
 */
@Component({
  selector: 'app-subnet-cheat-sheet',
  standalone: true,
  imports: [FormsModule, RouterLink, MatButtonModule, MatIconModule, CidrReaderComponent],
  templateUrl: './subnet-cheat-sheet.component.html',
  styleUrl: './subnet-cheat-sheet.component.scss',
})
export class SubnetCheatSheetComponent {
  readonly smallBlocks = [
    { prefix: '/24', mask: '255.255.255.0', block: '256', usable: '254', use: 'A normal LAN' },
    { prefix: '/25', mask: '255.255.255.128', block: '128', usable: '126', use: 'Half a /24' },
    { prefix: '/26', mask: '255.255.255.192', block: '64', usable: '62', use: 'A department of up to 62' },
    { prefix: '/27', mask: '255.255.255.224', block: '32', usable: '30', use: 'A small team or a wireless network' },
    { prefix: '/28', mask: '255.255.255.240', block: '16', usable: '14', use: 'A handful of servers or printers' },
    { prefix: '/29', mask: '255.255.255.248', block: '8', usable: '6', use: 'A tiny segment, such as a few cameras' },
    { prefix: '/30', mask: '255.255.255.252', block: '4', usable: '2', use: 'A link between two routers' },
    { prefix: '/31', mask: '255.255.255.254', block: '2', usable: '2*', use: 'A router link, only where routers support it' },
    { prefix: '/32', mask: '255.255.255.255', block: '1', usable: '1', use: 'One single address (used in firewall rules)' },
  ];

  readonly bigBlocks = [
    { prefix: '/8', mask: '255.0.0.0', addresses: '16,777,216', usable: '16,777,214' },
    { prefix: '/16', mask: '255.255.0.0', addresses: '65,536', usable: '65,534' },
    { prefix: '/20', mask: '255.255.240.0', addresses: '4,096', usable: '4,094' },
    { prefix: '/21', mask: '255.255.248.0', addresses: '2,048', usable: '2,046' },
    { prefix: '/22', mask: '255.255.252.0', addresses: '1,024', usable: '1,022' },
    { prefix: '/23', mask: '255.255.254.0', addresses: '512', usable: '510' },
  ];

  readonly maskValues = [
    { bits: 1, value: 128 }, { bits: 2, value: 192 }, { bits: 3, value: 224 }, { bits: 4, value: 240 },
    { bits: 5, value: 248 }, { bits: 6, value: 252 }, { bits: 7, value: 254 }, { bits: 8, value: 255 },
  ];

  readonly example = [
    { name: 'Office', need: '60', prefix: '/26', block: '64', network: '192.168.50.0', usable: '.1 to .62', broadcast: '.63' },
    { name: 'Lab', need: '25', prefix: '/27', block: '32', network: '192.168.50.64', usable: '.65 to .94', broadcast: '.95' },
    { name: 'Printers', need: '10', prefix: '/28', block: '16', network: '192.168.50.96', usable: '.97 to .110', broadcast: '.111' },
    { name: 'Router link', need: '2', prefix: '/30', block: '4', network: '192.168.50.112', usable: '.113 to .114', broadcast: '.115' },
  ];

  // ── Practice panel ─────────────────────────────────────────────────────
  readonly fields = ANSWER_FIELDS;
  problem: SubnetProblem = makeProblem(Math.random);
  given: Partial<Record<keyof SubnetAnswers, string>> = {};
  checked = false;
  showSteps = false;
  solved = 0;
  attempted = 0;

  isRight(key: keyof SubnetAnswers): boolean { return sameAnswer(this.given[key] ?? '', this.problem.answers[key]); }
  get rightCount(): number { return this.fields.filter(f => this.isRight(f.key)).length; }

  check() {
    this.checked = true;
    this.attempted++;
    if (this.rightCount === this.fields.length) this.solved++;
  }

  next() {
    this.problem = makeProblem(Math.random);
    this.given = {};
    this.checked = false;
    this.showSteps = false;
  }
}
