import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog';
import { FeedbackQuestion, FeedbackResponse } from '../../core/models/feedback.models';
import { FeedbackService } from '../../core/services/feedback.service';

interface QuestionStat {
  questionId: string;
  text: string;
  type: string;
  totalAnswers: number;
  optionCounts: { option: string; count: number; percent: number }[];
  textAnswers: string[];
}

interface ChartSegment {
  label: string;
  value: number;
  percent: number;
  color: string;
  path?: string; // used for Pie slices
  dashArray?: string; // used for Donut stroke
  dashOffset?: number; // used for Donut stroke
}

@Component({
  selector: 'app-feedback-analytics-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmDialogComponent],
  templateUrl: './feedback-analytics-dashboard.html',
  styleUrl: './feedback-analytics-dashboard.scss',
})
export class FeedbackAnalyticsDashboardComponent implements OnInit {
  private readonly feedbackService = inject(FeedbackService);

  readonly questions = signal<FeedbackQuestion[]>([]);
  readonly responses = signal<FeedbackResponse[]>([]);
  readonly isLoading = signal(true);
  readonly status = signal('');

  // Confirmation dialog state
  readonly confirmOpen = signal(false);
  readonly confirmTitle = signal('');
  readonly confirmMessage = signal('');
  readonly confirmSub = signal('');
  readonly confirmProcessing = signal(false);
  private pendingConfirmAction: (() => Promise<void>) | null = null;

  // Filtering & Pagination State
  readonly searchQuery = signal('');
  readonly currentPage = signal(1);
  readonly pageSize = 6;
  readonly selectedQuestionIdForChart = signal<string>('');

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    // Fetch questions
    this.feedbackService.getQuestions().subscribe({
      next: (qList) => {
        this.questions.set(qList);
        if (qList.length > 0 && !this.selectedQuestionIdForChart()) {
          // Default selection to first multiple choice question
          const firstMC = qList.find(
            (q) => q.type === 'radio' || q.type === 'checkbox' || q.type === 'dropdown',
          );
          this.selectedQuestionIdForChart.set(firstMC?.id || qList[0].id || '');
        }
      },
    });

    // Fetch responses in real-time
    this.feedbackService.getResponses().subscribe({
      next: (rList) => {
        this.responses.set(rList);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error(err);
        this.status.set('Failed to load feedback data.');
        this.isLoading.set(false);
      },
    });
  }

  // Calculated Stats List
  readonly stats = computed<QuestionStat[]>(() => {
    const qList = this.questions();
    const rList = this.responses();

    return qList.map((q) => {
      const qId = q.id!;
      const matchingAnswers = rList.flatMap((r) => r.answers.filter((a) => a.questionId === qId));
      const totalAnswers = matchingAnswers.length;

      const optionCounts: { option: string; count: number; percent: number }[] = [];
      const textAnswers: string[] = [];

      if (q.type === 'text' || q.type === 'textarea') {
        matchingAnswers.forEach((a) => {
          if (a.textAnswer) textAnswers.push(a.textAnswer);
        });
      } else {
        // Multiple choice question
        const countsMap: Record<string, number> = {};
        q.options?.forEach((opt) => (countsMap[opt] = 0));

        matchingAnswers.forEach((a) => {
          a.selectedAnswers?.forEach((sel) => {
            countsMap[sel] = (countsMap[sel] || 0) + 1;
          });
          if (a.textAnswer) {
            textAnswers.push(a.textAnswer);
          }
        });

        Object.entries(countsMap).forEach(([option, count]) => {
          const percent = totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0;
          optionCounts.push({ option, count, percent });
        });
      }

      return {
        questionId: qId,
        text: q.text,
        type: q.type,
        totalAnswers,
        optionCounts,
        textAnswers,
      };
    });
  });

  // 1. PIE CHART DATA (Responses per Question representation)
  readonly pieChartSegments = computed<ChartSegment[]>(() => {
    const statsList = this.stats();
    const totalResponsesCount = statsList.reduce((sum, s) => sum + s.totalAnswers, 0);
    const colors = ['#2563eb', '#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

    if (totalResponsesCount === 0) return [];

    let offsetPercent = 0;
    return statsList.map((s, idx) => {
      const percent = Math.round((s.totalAnswers / totalResponsesCount) * 100);
      const color = colors[idx % colors.length];
      const path = this.getPieArcPath(percent, offsetPercent);
      const segment = {
        label: s.text.length > 30 ? s.text.substring(0, 30) + '...' : s.text,
        value: s.totalAnswers,
        percent,
        color,
        path,
      };
      offsetPercent += percent;
      return segment;
    });
  });

  // 2. DONUT CHART DATA (Submission Types: Multiple Choice vs Text answers)
  readonly donutChartSegments = computed<ChartSegment[]>(() => {
    const rList = this.responses();
    let choiceCount = 0;
    let textCount = 0;

    rList.forEach((r) => {
      r.answers.forEach((a) => {
        if (a.selectedAnswers && a.selectedAnswers.length > 0) {
          choiceCount += a.selectedAnswers.length;
        }
        if (a.textAnswer) {
          textCount++;
        }
      });
    });

    const total = choiceCount + textCount;
    if (total === 0) return [];

    const choicePercent = Math.round((choiceCount / total) * 100);
    const textPercent = 100 - choicePercent;

    const segments = [
      {
        label: 'Multiple Choice Answers',
        value: choiceCount,
        percent: choicePercent,
        color: '#3b82f6',
      },
      { label: 'Free Text Answers', value: textCount, percent: textPercent, color: '#10b981' },
    ];

    // Calculate Dash offsets for SVG circles
    const circumference = 2 * Math.PI * 40; // 251.2
    let previousPercentSum = 0;

    return segments.map((seg) => {
      const dashArray = `${circumference}`;
      const offset = (previousPercentSum / 100) * circumference;
      const dashOffset = circumference - offset;

      previousPercentSum += seg.percent;

      return {
        ...seg,
        dashArray,
        dashOffset,
      };
    });
  });

  // 3. BAR CHART DATA (Details for selected Question)
  readonly selectedQuestionStat = computed<QuestionStat | null>(() => {
    const qId = this.selectedQuestionIdForChart();
    return this.stats().find((s) => s.questionId === qId) || null;
  });

  // Filtered responses list
  readonly filteredResponses = computed<FeedbackResponse[]>(() => {
    const list = this.responses();
    const query = this.searchQuery().toLowerCase().trim();

    if (!query) return list;

    return list.filter((r) => {
      // Search by email first, then fall back to userId for older records
      const matchUser = (r.userEmail || r.userId).toLowerCase().includes(query);
      const matchAnswer = r.answers.some((a) => {
        const textMatch = a.textAnswer?.toLowerCase().includes(query);
        const choicesMatch = a.selectedAnswers?.some((s) => s.toLowerCase().includes(query));
        return textMatch || choicesMatch;
      });
      return matchUser || matchAnswer;
    });
  });

  // Paginated responses list
  readonly paginatedResponses = computed<FeedbackResponse[]>(() => {
    const list = this.filteredResponses();
    const startIndex = (this.currentPage() - 1) * this.pageSize;
    return list.slice(startIndex, startIndex + this.pageSize);
  });

  readonly totalPages = computed(() => {
    return Math.ceil(this.filteredResponses().length / this.pageSize) || 1;
  });

  // Pie Sector Math Helper
  private getPieArcPath(percent: number, offsetPercent: number): string {
    if (percent === 100) {
      // SVG Arc can fail for complete 100% circles. Draw full circle outline path instead.
      return 'M 50 10 A 40 40 0 1 1 49.9 10 Z';
    }

    const cx = 50;
    const cy = 50;
    const r = 40;

    const startAngle = (offsetPercent / 100) * 360 - 90;
    const endAngle = ((offsetPercent + percent) / 100) * 360 - 90;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);

    const largeArcFlag = percent > 50 ? 1 : 0;

    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  }

  // Formatting timestamp helper
  formatDate(timestamp: any): string {
    if (!timestamp) return 'No Date';
    let date: Date;
    if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }
    return date.toLocaleString();
  }

  // Answer preview helper
  getAnswerPreview(response: FeedbackResponse): string {
    return response.answers
      .map((a) => {
        const answerVal =
          a.selectedAnswers && a.selectedAnswers.length > 0
            ? a.selectedAnswers.join(', ')
            : a.textAnswer || '';
        return `${a.questionText.substring(0, 15)}...: ${answerVal.substring(0, 15)}`;
      })
      .join(' | ');
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.set(this.currentPage() - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.set(this.currentPage() + 1);
    }
  }

  // Open dialog to clear analytics (responses)
  clearAnalyticsData(): void {
    this.confirmTitle.set('Clear analytics data?');
    this.confirmMessage.set(
      'This will permanently delete all collected feedback responses used for analytics.',
    );
    this.confirmSub.set('This cannot be undone. Consider exporting reports first.');
    this.pendingConfirmAction = async () => {
      this.confirmProcessing.set(true);
      this.status.set('Clearing analytics...');
      try {
        await this.feedbackService.clearAllResponses();
        this.status.set('Analytics data cleared.');
      } catch (err) {
        console.error(err);
        this.status.set('Failed to clear analytics data.');
      } finally {
        this.confirmProcessing.set(false);
        this.confirmOpen.set(false);
        setTimeout(() => this.status.set(''), 3000);
      }
    };
    this.confirmOpen.set(true);
  }

  async onConfirmed(): Promise<void> {
    if (this.pendingConfirmAction) {
      await this.pendingConfirmAction();
      this.pendingConfirmAction = null;
    }
  }

  onCancelled(): void {
    this.pendingConfirmAction = null;
    this.confirmOpen.set(false);
  }
}
