import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { ContentService } from '../../services/content.service';
import { Acronym } from '../../models/flashcard.model';

@Component({
  selector: 'app-acronyms',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatChipsModule, MatProgressSpinnerModule, MatSelectModule],
  templateUrl: './acronyms.component.html',
  styleUrl: './acronyms.component.scss'
})
export class AcronymsComponent implements OnInit {
  private contentService = inject(ContentService);

  allAcronyms: Acronym[] = [];
  filteredAcronyms: Acronym[] = [];
  loading = false;
  error = '';
  searchText = '';
  selectedCategory = 'All';
  categories: string[] = ['All'];

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading = true;
    this.contentService.getAcronyms().subscribe({
      next: a => {
        this.allAcronyms = a.sort((x, y) => x.acronym.localeCompare(y.acronym));
        const cats = [...new Set(a.map(x => x.category).filter(Boolean))].sort();
        this.categories = ['All', ...cats];
        this.filter();
        this.loading = false;
      },
      error: e => { this.error = e.message; this.loading = false; }
    });
  }

  filter() {
    const q = this.searchText.toLowerCase();
    this.filteredAcronyms = this.allAcronyms.filter(a => {
      const matchSearch = !q || a.acronym.toLowerCase().includes(q) ||
        a.expansion.toLowerCase().includes(q) || a.definition?.toLowerCase().includes(q);
      const matchCat = this.selectedCategory === 'All' || a.category === this.selectedCategory;
      return matchSearch && matchCat;
    });
  }
}
