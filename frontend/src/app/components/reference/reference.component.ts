import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { SubnetCheatSheetComponent } from './subnet-cheat-sheet.component';
import { ReviewComponent } from '../review/review.component';
import { ProgressService, cardKey } from '../../services/progress.service';
import { StudyCard } from '../../utils/study-card';
import { isDueCard } from '../../utils/srs';
import { REFERENCE_DECK_SECTIONS, referenceCards } from './reference-cards';
import {
  ACCESS_MODELS, ATTACK_FRAMEWORKS, AUTH_PROTOCOLS, BACKUP_TYPES, BCDR_METRICS, CIPHERS, CLOUD_MODELS, COMPLIANCE_FRAMEWORKS,
  DATA_CLASSIFICATIONS, HASHES, IR_PHASES, MFA_FACTORS, PKI_REFERENCE, PORTS, RAID_LEVELS, REPLACEMENTS, RISK_FORMULAS,
  SITE_TYPES, THREAT_ACTORS, VPN_PROTOCOLS, WIRELESS,
  AuthEntry, CipherEntry, FormulaEntry, HashEntry, MetricEntry, PortEntry, ProcessStepEntry, RaidEntry, RefEntry, SiteEntry,
  ThreatActorEntry,
} from './reference-data';

@Component({
  selector: 'app-reference',
  standalone: true,
  imports: [CommonModule, FormsModule, MatTabsModule, MatInputModule,
    MatFormFieldModule, MatIconModule, MatTooltipModule, MatChipsModule,
    MatButtonModule, RouterLink, SubnetCheatSheetComponent, ReviewComponent],
  templateUrl: './reference.component.html',
  styleUrl: './reference.component.scss'
})
export class ReferenceComponent {
  searchText = '';

  /**
   * The sections, in the same order as the tabs in the template, grouped for the dropdown. `count` is how many
   * rows match the search box (null for a section the search does not cover). `key` lets other pages open a
   * section directly with ?tab=key.
   */
  readonly sections: { key: string; label: string; group: string; count: () => number | null }[] = [
    { key: 'ports', label: 'Network Ports', group: 'Networking', count: () => this.filteredPorts.length },
    { key: 'subnetting', label: 'Subnetting', group: 'Networking', count: () => null },
    { key: 'vpn', label: 'VPN & Tunneling', group: 'Networking', count: () => this.filteredVpn.length },
    { key: 'wireless', label: 'Wireless Security', group: 'Networking', count: () => this.filteredWireless.length },
    { key: 'legacy', label: 'Legacy → Modern', group: 'Networking', count: () => this.filteredReplacements.length },
    { key: 'ciphers', label: 'Encryption Ciphers', group: 'Cryptography', count: () => this.filteredCiphers.length },
    { key: 'hashes', label: 'Hashing & MACs', group: 'Cryptography', count: () => this.filteredHashes.length },
    { key: 'pki', label: 'PKI & Certs', group: 'Cryptography', count: () => this.filteredPkiReference.length },
    { key: 'auth', label: 'Auth Protocols', group: 'Identity and access', count: () => this.filteredAuth.length },
    { key: 'mfa', label: 'MFA Factors', group: 'Identity and access', count: () => this.filteredMfaFactors.length },
    { key: 'access', label: 'Access Models', group: 'Identity and access', count: () => this.filteredAccessModels.length },
    { key: 'actors', label: 'Threat Actors', group: 'Threats and response', count: () => this.filteredThreatActors.length },
    { key: 'frameworks', label: 'Attack Frameworks', group: 'Threats and response', count: () => this.filteredAttackFrameworks.length },
    { key: 'ir', label: 'IR Phases', group: 'Threats and response', count: () => this.filteredIrPhases.length },
    { key: 'bcdr', label: 'BCP/DR Metrics', group: 'Resilience and recovery', count: () => this.filteredBcdrMetrics.length },
    { key: 'backups', label: 'Backup Types', group: 'Resilience and recovery', count: () => this.filteredBackupTypes.length },
    { key: 'raid', label: 'RAID Levels', group: 'Resilience and recovery', count: () => this.filteredRaidLevels.length },
    { key: 'sites', label: 'Site Types', group: 'Resilience and recovery', count: () => this.filteredSiteTypes.length },
    { key: 'cloud', label: 'Cloud Models', group: 'Resilience and recovery', count: () => this.filteredCloudModels.length },
    { key: 'risk', label: 'Risk Formulas', group: 'Risk and governance', count: () => this.filteredRiskFormulas.length },
    { key: 'compliance', label: 'Compliance', group: 'Risk and governance', count: () => this.filteredComplianceFrameworks.length },
    { key: 'data', label: 'Data Classification', group: 'Risk and governance', count: () => this.filteredDataClassifications.length },
  ];

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly progress = inject(ProgressService);

  selectedTab = Math.max(0, this.sections.findIndex(sec => sec.key === this.route.snapshot.queryParamMap.get('tab')));

  // ── Reference deck (Review mode) ───────────────────────────
  // Whether it is open and which section it covers live in the address (?mode=review&deck=ports), so a refresh or
  // a link from the Today page lands in the same place.

  readonly deckSections = REFERENCE_DECK_SECTIONS;
  readonly allRefCards = referenceCards();
  reviewing = this.route.snapshot.queryParamMap.get('mode') === 'review';
  reviewSection = this.deckSections.some(s => s.key === this.route.snapshot.queryParamMap.get('deck'))
    ? this.route.snapshot.queryParamMap.get('deck')! : 'all';
  reviewCards: StudyCard[] = this.cardsFor(this.reviewSection);

  cardsFor(section: string): StudyCard[] {
    const label = this.deckSections.find(s => s.key === section)?.label;
    return label ? this.allRefCards.filter(c => c.category === label) : this.allRefCards;
  }

  /** Cards in the deck ready in Review mode now. */
  get refDue(): number {
    const cards = this.progress.data().cards;
    const now = Date.now();
    return this.allRefCards.filter(c => isDueCard(cards[cardKey('ref', c.id)], now)).length;
  }

  openReview() {
    this.reviewing = true;
    this.saveReviewView();
  }

  closeReview() {
    this.reviewing = false;
    this.saveReviewView();
  }

  setReviewSection(section: string) {
    this.reviewSection = section;
    this.reviewCards = this.cardsFor(section);
    this.saveReviewView();
  }

  private saveReviewView() {
    void this.router.navigate([], {
      queryParams: { mode: this.reviewing ? 'review' : null, deck: this.reviewing && this.reviewSection !== 'all' ? this.reviewSection : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** The dropdown's option groups, each section keeping its tab index. */
  get sectionGroups(): { name: string; sections: { index: number; label: string; count: number | null }[] }[] {
    const groups: { name: string; sections: { index: number; label: string; count: number | null }[] }[] = [];
    this.sections.forEach((sec, index) => {
      let g = groups.find(x => x.name === sec.group);
      if (!g) groups.push(g = { name: sec.group, sections: [] });
      g.sections.push({ index, label: sec.label, count: sec.count() });
    });
    return groups;
  }

  /** While searching, leave a section with no matches for the first one that has some. */
  jumpToMatches() {
    if (!this.searchText.trim() || this.sections[this.selectedTab].count() !== 0) return;
    const first = this.sections.findIndex(sec => (sec.count() ?? 0) > 0);
    if (first >= 0) this.selectedTab = first;
  }

  get searchableCount(): number { return this.sections.filter(sec => sec.count() !== null).length; }
  get sectionsWithMatches(): number { return this.sections.filter(sec => (sec.count() ?? 0) > 0).length; }

  // The tables, from reference-data.ts.
  readonly PORTS = PORTS;
  readonly CIPHERS = CIPHERS;
  readonly HASHES = HASHES;
  readonly AUTH_PROTOCOLS = AUTH_PROTOCOLS;
  readonly VPN_PROTOCOLS = VPN_PROTOCOLS;
  readonly WIRELESS = WIRELESS;
  readonly RISK_FORMULAS = RISK_FORMULAS;
  readonly BCDR_METRICS = BCDR_METRICS;
  readonly BACKUP_TYPES = BACKUP_TYPES;
  readonly RAID_LEVELS = RAID_LEVELS;
  readonly ACCESS_MODELS = ACCESS_MODELS;
  readonly IR_PHASES = IR_PHASES;
  readonly CLOUD_MODELS = CLOUD_MODELS;
  readonly COMPLIANCE_FRAMEWORKS = COMPLIANCE_FRAMEWORKS;
  readonly ATTACK_FRAMEWORKS = ATTACK_FRAMEWORKS;
  readonly PKI_REFERENCE = PKI_REFERENCE;
  readonly MFA_FACTORS = MFA_FACTORS;
  readonly SITE_TYPES = SITE_TYPES;
  readonly THREAT_ACTORS = THREAT_ACTORS;
  readonly DATA_CLASSIFICATIONS = DATA_CLASSIFICATIONS;

  get filteredPorts(): PortEntry[] {
    const q = this.searchText.toLowerCase();
    if (!q) return this.PORTS;
    return this.PORTS.filter(p =>
      p.port.includes(q) || p.protocol.toLowerCase().includes(q) ||
      p.service.toLowerCase().includes(q) || p.notes.toLowerCase().includes(q) ||
      p.transport.toLowerCase().includes(q) || p.role.toLowerCase().includes(q) || p.use.toLowerCase().includes(q)
    );
  }

  get filteredCiphers(): CipherEntry[] {
    const q = this.searchText.toLowerCase();
    if (!q) return this.CIPHERS;
    return this.CIPHERS.filter(c =>
      c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q) ||
      c.use.toLowerCase().includes(q) || c.notes.toLowerCase().includes(q)
    );
  }

  get filteredHashes(): HashEntry[] {
    const q = this.searchText.toLowerCase();
    if (!q) return this.HASHES;
    return this.HASHES.filter(h =>
      h.name.toLowerCase().includes(q) || h.use.toLowerCase().includes(q) ||
      h.notes.toLowerCase().includes(q)
    );
  }

  get filteredAuth(): AuthEntry[] {
    const q = this.searchText.toLowerCase();
    if (!q) return this.AUTH_PROTOCOLS;
    return this.AUTH_PROTOCOLS.filter(a =>
      a.name.toLowerCase().includes(q) || a.port.toLowerCase().includes(q) ||
      a.type.toLowerCase().includes(q) || a.notes.toLowerCase().includes(q)
    );
  }

  get filteredVpn(): AuthEntry[] {
    const q = this.searchText.toLowerCase();
    if (!q) return this.VPN_PROTOCOLS;
    return this.VPN_PROTOCOLS.filter(a =>
      a.name.toLowerCase().includes(q) || a.port.toLowerCase().includes(q) ||
      a.type.toLowerCase().includes(q) || a.notes.toLowerCase().includes(q)
    );
  }

  get filteredWireless(): AuthEntry[] {
    const q = this.searchText.toLowerCase();
    if (!q) return this.WIRELESS;
    return this.WIRELESS.filter(a =>
      a.name.toLowerCase().includes(q) || a.port.toLowerCase().includes(q) ||
      a.type.toLowerCase().includes(q) || a.notes.toLowerCase().includes(q)
    );
  }

  get filteredRiskFormulas(): FormulaEntry[] {
    const q = this.searchText.toLowerCase();
    if (!q) return this.RISK_FORMULAS;
    return this.RISK_FORMULAS.filter(f =>
      f.name.toLowerCase().includes(q) || f.formula.toLowerCase().includes(q) ||
      f.variables.toLowerCase().includes(q) || f.example.toLowerCase().includes(q)
    );
  }

  get filteredBcdrMetrics(): MetricEntry[] {
    const q = this.searchText.toLowerCase();
    if (!q) return this.BCDR_METRICS;
    return this.BCDR_METRICS.filter(m =>
      m.abbr.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) ||
      m.definition.toLowerCase().includes(q) || m.example.toLowerCase().includes(q)
    );
  }

  get filteredBackupTypes(): RefEntry[] {
    const q = this.searchText.toLowerCase();
    if (!q) return this.BACKUP_TYPES;
    return this.BACKUP_TYPES.filter(r =>
      r.name.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q) || r.detail.toLowerCase().includes(q)
    );
  }

  get filteredRaidLevels(): RaidEntry[] {
    const q = this.searchText.toLowerCase();
    if (!q) return this.RAID_LEVELS;
    return this.RAID_LEVELS.filter(r =>
      r.level.toLowerCase().includes(q) || r.faultTolerance.toLowerCase().includes(q) ||
      r.performance.toLowerCase().includes(q) || r.notes.toLowerCase().includes(q)
    );
  }

  get filteredAccessModels(): RefEntry[] {
    const q = this.searchText.toLowerCase();
    if (!q) return this.ACCESS_MODELS;
    return this.ACCESS_MODELS.filter(r =>
      r.name.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q) || r.detail.toLowerCase().includes(q)
    );
  }

  get filteredIrPhases(): ProcessStepEntry[] {
    const q = this.searchText.toLowerCase();
    if (!q) return this.IR_PHASES;
    return this.IR_PHASES.filter(p =>
      p.phase.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.keyActivities.toLowerCase().includes(q)
    );
  }

  get filteredCloudModels(): RefEntry[] {
    const q = this.searchText.toLowerCase();
    if (!q) return this.CLOUD_MODELS;
    return this.CLOUD_MODELS.filter(r =>
      r.name.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q) || r.detail.toLowerCase().includes(q)
    );
  }

  get cloudModelCategories(): string[] {
    return [...new Set(this.CLOUD_MODELS.map(r => r.category!))];
  }

  getCloudModelsForCategory(cat: string): RefEntry[] {
    return this.filteredCloudModels.filter(r => r.category === cat);
  }

  get filteredComplianceFrameworks(): RefEntry[] {
    const q = this.searchText.toLowerCase();
    if (!q) return this.COMPLIANCE_FRAMEWORKS;
    return this.COMPLIANCE_FRAMEWORKS.filter(r =>
      r.name.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q) || r.detail.toLowerCase().includes(q)
    );
  }

  get filteredAttackFrameworks(): RefEntry[] {
    const q = this.searchText.toLowerCase();
    if (!q) return this.ATTACK_FRAMEWORKS;
    return this.ATTACK_FRAMEWORKS.filter(r =>
      r.name.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q) || r.detail.toLowerCase().includes(q)
    );
  }

  get filteredPkiReference(): RefEntry[] {
    const q = this.searchText.toLowerCase();
    if (!q) return this.PKI_REFERENCE;
    return this.PKI_REFERENCE.filter(r =>
      r.name.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q) || r.detail.toLowerCase().includes(q)
    );
  }

  get filteredMfaFactors(): RefEntry[] {
    const q = this.searchText.toLowerCase();
    if (!q) return this.MFA_FACTORS;
    return this.MFA_FACTORS.filter(r =>
      r.name.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q) || r.detail.toLowerCase().includes(q)
    );
  }

  get filteredSiteTypes(): SiteEntry[] {
    const q = this.searchText.toLowerCase();
    if (!q) return this.SITE_TYPES;
    return this.SITE_TYPES.filter(s =>
      s.type.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) ||
      s.recoveryTime.toLowerCase().includes(q) || s.cost.toLowerCase().includes(q)
    );
  }

  get filteredThreatActors(): ThreatActorEntry[] {
    const q = this.searchText.toLowerCase();
    if (!q) return this.THREAT_ACTORS;
    return this.THREAT_ACTORS.filter(t =>
      t.name.toLowerCase().includes(q) || t.motivation.toLowerCase().includes(q) ||
      t.sophistication.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q)
    );
  }

  get filteredDataClassifications(): RefEntry[] {
    const q = this.searchText.toLowerCase();
    if (!q) return this.DATA_CLASSIFICATIONS;
    return this.DATA_CLASSIFICATIONS.filter(r =>
      r.name.toLowerCase().includes(q) || r.summary.toLowerCase().includes(q) || r.detail.toLowerCase().includes(q)
    );
  }

  readonly REPLACEMENTS = REPLACEMENTS;

  get filteredReplacements() {
    const q = this.searchText.toLowerCase();
    if (!q) return this.REPLACEMENTS;
    return this.REPLACEMENTS.filter(r =>
      r.from.name.toLowerCase().includes(q) || r.to.name.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) || r.reason.toLowerCase().includes(q) ||
      r.from.port.toLowerCase().includes(q) || r.to.port.toLowerCase().includes(q)
    );
  }

  get replacementCategories(): string[] {
    return [...new Set(this.REPLACEMENTS.map(r => r.category))];
  }

  getReplacementsForCategory(cat: string) {
    return this.filteredReplacements.filter(r => r.category === cat);
  }

  statusLabel(s: string): string {
    return { secure: 'Secure', insecure: 'Weak/Insecure', deprecated: 'Deprecated', neutral: 'Context-dependent' }[s] ?? s;
  }
}
