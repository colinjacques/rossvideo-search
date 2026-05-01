/**
 * Meilisearch Full-Page Search
 * 
 * OpenAI-style FULL page search takeover with AI Overview
 * Search results appear as a complete page overlay without navigation
 * 
 * @package RossVideo
 */

(function($) {
    'use strict';
    
    // Debounce helper
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // Full-page Search
    const FullPageSearch = {
        // State
        isOpen: false,
        currentQuery: '',
        currentFilters: [],
        currentPage: 0,
        resultsPerPage: 20,
        isLoading: false,
        totalHits: 0,
        results: [],
        allResults: [], // Cache all results for client-side filtering
        selectedIndex: -1,
        aiOverviewEnabled: false,
        
        // Elements
        $modal: null,
        $input: null,
        $results: null,
        $filterContainer: null,
        $aiOverview: null,
        
        // Initialize
        init() {
            // Check if AI Overview is available
            this.aiOverviewEnabled = typeof rossVideoAIOverview !== 'undefined' && rossVideoAIOverview.enabled;
            
            this.createModal();
            this.bindEvents();
        },
        
        // Create the modal HTML
        createModal() {
            const filterOptions = this.getFilterOptions();
            const aiOverviewHtml = this.aiOverviewEnabled ? this.getAIOverviewHtml() : '';
            
            this.$modal = $(`
                <div class="meili-fullpage" id="fullpage-search" aria-hidden="true" role="dialog" aria-modal="true" aria-label="Search">
                    <!-- Header -->
                    <header class="meili-fullpage__header">
                        <div class="meili-fullpage__header-inner">
                            <a href="/" class="meili-fullpage__logo">
                                <img src="${rossVideoMeili.logoUrl || (rossVideoMeili.themeUrl || '/wp-content/themes/rossvideo') + '/img/ross-video-logo.svg'}" alt="Ross Video" />
                            </a>
                            <div class="meili-fullpage__search-box">
                                <svg class="meili-fullpage__search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none">
                                    <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M21 21L16.8 16.8" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                                </svg>
                                <input type="text" class="meili-fullpage__input" placeholder="Search products, resources, documentation..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
                                <button class="meili-fullpage__clear" type="button" aria-label="Clear search" style="display: none;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                </button>
                            </div>
                            <button class="meili-fullpage__close" type="button" aria-label="Close search">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </button>
                        </div>
                    </header>
                    
                    <!-- Main Content -->
                    <main class="meili-fullpage__main">
                        <div class="meili-fullpage__container">
                            <!-- Filters -->
                            <div class="meili-fullpage__filters">
                                <div class="meili-fullpage__filter-scroll">
                                    <button class="meili-fullpage__filter active" data-filter="all">All Results</button>
                                    ${filterOptions}
                                </div>
                            </div>
                            
                            <!-- AI Overview -->
                            ${aiOverviewHtml}
                            
                            <!-- Results -->
                            <div class="meili-fullpage__results">
                                <div class="meili-fullpage__empty">
                                    <div class="meili-fullpage__empty-icon">
                                        <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
                                            <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                            <path d="M21 21L16.8 16.8" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                                        </svg>
                                    </div>
                                    <h2>Search Ross Video</h2>
                                    <p>Find products, documentation, tutorials, case studies, and more</p>
                                    <div class="meili-fullpage__suggestions">
                                        <span>Try:</span>
                                        <button type="button" class="meili-fullpage__suggestion" data-query="switchers">Switchers</button>
                                        <button type="button" class="meili-fullpage__suggestion" data-query="graphics">Graphics</button>
                                        <button type="button" class="meili-fullpage__suggestion" data-query="cameras">Cameras</button>
                                        <button type="button" class="meili-fullpage__suggestion" data-query="workflow">Workflow</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
            `);
            
            $('body').append(this.$modal);
            
            // Cache elements
            this.$input = this.$modal.find('.meili-fullpage__input');
            this.$results = this.$modal.find('.meili-fullpage__results');
            this.$filterContainer = this.$modal.find('.meili-fullpage__filters');
            this.$aiOverview = this.$modal.find('.meili-fullpage__ai-overview');
        },
        
        getFilterOptions() {
            // Use filter options from PHP (single source of truth for index UIDs and labels)
            const config = window.RossVideoMeili;
            if (config && Array.isArray(config.filterOptions) && config.filterOptions.length > 0) {
                return config.filterOptions.map(f =>
                    `<button class="meili-fullpage__filter" data-filter="${f.key}">${f.label}</button>`
                ).join('');
            }
            // Fallback if not localized (e.g. script loaded before inline config)
            const filters = [
                { key: 'product', label: 'Products' },
                { key: 'page', label: 'Pages' },
                { key: 'documents', label: 'Documents' },
                { key: 'case_studies', label: 'Case Studies' },
                { key: 'events', label: 'Events' },
            ];
            return filters.map(f =>
                `<button class="meili-fullpage__filter" data-filter="${f.key}">${f.label}</button>`
            ).join('');
        },
        
        getAIOverviewHtml() {
            return `
                <div class="meili-fullpage__ai-overview" style="display: none;">
                    <div class="meili-fullpage__ai-header">
                        <div class="meili-fullpage__ai-title">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            <span>AI Overview</span>
                        </div>
                        <span class="meili-fullpage__ai-badge">Powered by Gemini</span>
                    </div>
                    <div class="meili-fullpage__ai-content">
                        <div class="meili-fullpage__ai-loader">
                            <div class="meili-fullpage__spinner"></div>
                            <span>Generating AI overview...</span>
                        </div>
                    </div>
                </div>
            `;
        },
        
        // Bind events
        bindEvents() {
            const self = this;
            
            // Search input with debounce
            this.$input.on('input', debounce(function() {
                self.currentQuery = self.$input.val().trim();
                self.currentPage = 0;
                
                if (self.currentQuery.length >= 2) {
                    self.search();
                } else if (self.currentQuery.length === 0) {
                    self.showEmptyState();
                }
            }, 400));
            
            // Clear button
            this.$modal.on('click', '.meili-fullpage__clear', () => {
                this.$input.val('').focus();
                this.currentQuery = '';
                this.$modal.find('.meili-fullpage__clear').hide();
                this.showEmptyState();
            });
            
            // Show/hide clear button
            this.$input.on('input', function() {
                self.$modal.find('.meili-fullpage__clear').toggle($(this).val().length > 0);
            });
            
            // Close button
            this.$modal.on('click', '.meili-fullpage__close', () => {
                this.close();
            });
            
            // Filter clicks - instant client-side filtering
            this.$modal.on('click', '.meili-fullpage__filter', function() {
                const filter = $(this).data('filter');
                
                self.$filterContainer.find('.meili-fullpage__filter').removeClass('active');
                $(this).addClass('active');
                
                if (filter === 'all') {
                    self.currentFilters = [];
                } else {
                    self.currentFilters = [filter];
                }
                
                // Client-side filter from cached results (instant)
                self.currentPage = 0;
                self.applyFilters();
            });
            
            // Suggestion clicks
            this.$modal.on('click', '.meili-fullpage__suggestion', function() {
                const query = $(this).data('query');
                self.$input.val(query);
                self.currentQuery = query;
                self.$modal.find('.meili-fullpage__clear').show();
                self.search();
            });
            
            // Keyboard navigation
            this.$input.on('keydown', (e) => {
                this.handleKeydown(e);
            });
            
            // Escape to close
            $(document).on('keydown.fullpagesearch', (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    this.close();
                }
            });
            
            // Result click
            this.$modal.on('click', '.meili-fullpage__result', function(e) {
                if (!$(e.target).closest('a').length) {
                    const url = $(this).data('url');
                    if (url) {
                        window.location.href = url;
                    }
                }
            });
            
            // Load more
            this.$modal.on('click', '.meili-fullpage__load-more', (e) => {
                e.preventDefault();
                this.loadMore();
            });
            
            // AI Overview retry
            this.$modal.on('click', '.meili-fullpage__ai-retry', () => {
                this.generateAIOverview();
            });
        },
        
        // Handle keyboard
        handleKeydown(e) {
            const $results = this.$results.find('.meili-fullpage__result');
            const maxIndex = $results.length - 1;
            
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    this.selectedIndex = Math.min(this.selectedIndex + 1, maxIndex);
                    this.updateSelection();
                    break;
                    
                case 'ArrowUp':
                    e.preventDefault();
                    this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
                    this.updateSelection();
                    break;
                    
                case 'Enter':
                    if (this.selectedIndex >= 0) {
                        e.preventDefault();
                        const url = $results.eq(this.selectedIndex).data('url');
                        if (url) {
                            window.location.href = url;
                        }
                    }
                    break;
            }
        },
        
        updateSelection() {
            const $results = this.$results.find('.meili-fullpage__result');
            $results.removeClass('is-selected');
            
            if (this.selectedIndex >= 0) {
                const $selected = $results.eq(this.selectedIndex).addClass('is-selected');
                if ($selected.length) {
                    $selected[0].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            }
        },
        
        // Open
        open() {
            if (this.isOpen) return;
            
            this.isOpen = true;
            this.$modal.addClass('is-open').attr('aria-hidden', 'false');
            $('body').addClass('meili-fullpage-open');
            
            setTimeout(() => {
                this.$input.focus();
            }, 100);
            
            if (history.pushState) {
                history.pushState({ search: true }, '', window.location.href);
            }
        },
        
        // Close
        close() {
            if (!this.isOpen) return;
            
            this.isOpen = false;
            this.$modal.removeClass('is-open').attr('aria-hidden', 'true');
            $('body').removeClass('meili-fullpage-open');
            
            this.selectedIndex = -1;
            
            if (history.state && history.state.search) {
                history.back();
            }
        },
        
        // Show empty state
        showEmptyState() {
            this.$aiOverview.hide();
            this.$results.html(`
                <div class="meili-fullpage__empty">
                    <div class="meili-fullpage__empty-icon">
                        <svg width="80" height="80" viewBox="0 0 24 24" fill="none">
                            <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M21 21L16.8 16.8" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <h2>Search Ross Video</h2>
                    <p>Find products, documentation, tutorials, case studies, and more</p>
                    <div class="meili-fullpage__suggestions">
                        <span>Try:</span>
                        <button type="button" class="meili-fullpage__suggestion" data-query="switchers">Switchers</button>
                        <button type="button" class="meili-fullpage__suggestion" data-query="graphics">Graphics</button>
                        <button type="button" class="meili-fullpage__suggestion" data-query="cameras">Cameras</button>
                        <button type="button" class="meili-fullpage__suggestion" data-query="workflow">Workflow</button>
                    </div>
                </div>
            `);
            this.results = [];
            this.allResults = [];
            this.selectedIndex = -1;
        },
        
        // Show loading
        showLoading() {
            // Show AI Overview loading if enabled
            if (this.aiOverviewEnabled) {
                this.$aiOverview.show().removeClass('has-content has-error').addClass('is-loading');
                this.$aiOverview.find('.meili-fullpage__ai-content').html(`
                    <div class="meili-fullpage__ai-loader">
                        <div class="meili-fullpage__spinner"></div>
                        <span>Generating AI overview...</span>
                    </div>
                `);
            }
            
            this.$results.html(`
                <div class="meili-fullpage__loading">
                    <div class="meili-fullpage__spinner-large"></div>
                    <p>Searching...</p>
                </div>
            `);
        },
        
        // Search
        async search(append = false) {
            if (this.isLoading && !append) return;
            
            this.isLoading = true;
            
            if (!append) {
                this.showLoading();
                
                // Reset filters to "All" on new search
                this.currentFilters = [];
                this.$filterContainer.find('.meili-fullpage__filter').removeClass('active');
                this.$filterContainer.find('.meili-fullpage__filter[data-filter="all"]').addClass('active');
                
                // Fire event for any listeners
                $(document).trigger('rossvideo:search:start', {
                    query: this.currentQuery
                });
            }
            
            try {
                const response = await this.doSearch();
                
                if (response) {
                    this.totalHits = response.estimatedTotalHits || 0;
                    
                    if (append) {
                        this.results = [...this.results, ...response.hits];
                        this.allResults = [...this.allResults, ...response.hits];
                    } else {
                        this.results = response.hits;
                        this.allResults = response.hits; // Cache all results
                    }
                    
                    this.renderResults(append);
                    
                    // Fire completion event and generate AI Overview
                    if (!append) {
                        $(document).trigger('rossvideo:search:complete', {
                            query: this.currentQuery,
                            hits: this.results,
                            totalHits: this.totalHits
                        });
                        
                        if (this.aiOverviewEnabled) {
                            this.generateAIOverview();
                        }
                    }
                } else {
                    this.showError();
                }
            } catch (error) {
                console.error('Search error:', error);
                this.showError();
            }
            
            this.isLoading = false;
        },
        
        // Apply filters client-side (instant)
        applyFilters() {
            if (this.allResults.length === 0) return;
            
            if (this.currentFilters.length === 0) {
                // Show all results
                this.results = [...this.allResults];
            } else {
                // Filter by type
                this.results = this.allResults.filter(result => {
                    const type = result._index || result.post_type || result.type || '';
                    return this.currentFilters.includes(type);
                });
            }
            
            this.totalHits = this.results.length;
            this.renderFilteredResults();
        },
        
        // Render filtered results without affecting AI Overview
        renderFilteredResults() {
            this.selectedIndex = -1;
            
            if (this.results.length === 0) {
                // Don't hide AI Overview - just show no results for this filter
                this.$results.html(`
                    <div class="meili-fullpage__no-results">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                            <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M21 21L16.8 16.8" stroke="currentColor" stroke-width="1.5"/>
                        </svg>
                        <h3>No results in this category</h3>
                        <p>Try selecting "All Results" or a different filter</p>
                    </div>
                `);
                return;
            }
            
            const resultsHtml = this.results.map((hit, index) => this.getResultHtml(hit, index)).join('');
            
            this.$results.html(`
                <div class="meili-fullpage__results-header">
                    <h2>${this.totalHits} result${this.totalHits !== 1 ? 's' : ''} for "${this.escapeHtml(this.currentQuery)}"</h2>
                </div>
                <div class="meili-fullpage__results-grid">
                    ${resultsHtml}
                </div>
                <div class="meili-fullpage__results-end">
                    <span>${this.totalHits} result${this.totalHits !== 1 ? 's' : ''}</span>
                </div>
            `);
        },
        
        // Meilisearch query
        async doSearch() {
            const { MeiliClient } = window.RossVideoMeili;
            
            const options = {
                limit: this.resultsPerPage,
                offset: this.currentPage * this.resultsPerPage,
                attributesToRetrieve: ['id', 'title', 'link', 'featured_media_url', 'excerpt', 'strippedContent', 'post_type', '_index', 'thumbnail', 'featured_image'],
                attributesToHighlight: ['title', 'excerpt', 'strippedContent'],
                highlightPreTag: '<mark>',
                highlightPostTag: '</mark>',
            };
            
            let indexes = [...MeiliClient.indexes];
            
            if (this.currentFilters.length > 0) {
                indexes = this.currentFilters.filter(f => MeiliClient.indexes.includes(f));
                if (indexes.length === 0) {
                    indexes = [...MeiliClient.indexes];
                }
            }
            
            const queries = indexes.map(indexUid => ({
                indexUid,
                ...options,
                q: this.currentQuery
            }));
            
            try {
                const response = await fetch(`${MeiliClient.host}/multi-search`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${MeiliClient.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ queries }),
                });
                
                if (!response.ok) {
                    throw new Error(`Search failed: ${response.status}`);
                }
                
                const data = await response.json();
                
                const allHits = [];
                let totalHits = 0;
                
                if (data.results) {
                    data.results.forEach(result => {
                        totalHits += result.estimatedTotalHits || result.totalHits || 0;
                        if (result.hits) {
                            result.hits.forEach(hit => {
                                allHits.push({
                                    ...hit,
                                    _index: result.indexUid,
                                });
                            });
                        }
                    });
                }
                
                allHits.sort((a, b) => (b._rankingScore || 0) - (a._rankingScore || 0));
                
                return {
                    hits: allHits,
                    estimatedTotalHits: totalHits,
                };
                
            } catch (error) {
                console.error('Meilisearch error:', error);
                return null;
            }
        },
        
        // Generate AI Overview
        generateAIOverview() {
            if (!this.aiOverviewEnabled || !this.currentQuery || this.results.length === 0) {
                this.$aiOverview.hide();
                return;
            }
            
            this.$aiOverview.show().removeClass('has-content has-error').addClass('is-loading');
            this.$aiOverview.find('.meili-fullpage__ai-content').html(`
                <div class="meili-fullpage__ai-loader">
                    <div class="meili-fullpage__spinner"></div>
                    <span>Generating AI overview...</span>
                </div>
            `);
            
            // Prepare results for AI
            const preparedResults = this.results.slice(0, 10).map(result => {
                let url = result.link || result.url || result.permalink || '';
                if (url) {
                    const sourceDomains = ['ross-video-2023.local', 'rossvideo.com', 'www.rossvideo.com', 'rossvideo20dev.wpengine.com', 'rossvideo20staging.wpengine.com'];
                    sourceDomains.forEach(domain => {
                        if (url.includes(domain)) {
                            url = url.replace(new RegExp(`https?://[^/]*${domain.replace('.', '\\\\.')}`), window.location.origin);
                        }
                    });
                }
                return {
                    title: (result._formatted?.title || result.title || '').substring(0, 200),
                    post_type: result.post_type || result._index || 'content',
                    excerpt: (result._formatted?.excerpt || result.excerpt || '').substring(0, 500),
                    strippedContent: (result.strippedContent || '').substring(0, 500),
                    url: url,
                };
            });
            
            $.ajax({
                url: rossVideoAIOverview.ajaxUrl,
                type: 'POST',
                data: {
                    action: 'ai_search_overview',
                    nonce: rossVideoAIOverview.nonce,
                    query: this.currentQuery,
                    results: preparedResults,
                },
                success: (response) => {
                    if (response.success && response.data.overview) {
                        this.$aiOverview.removeClass('is-loading has-error').addClass('has-content');
                        this.$aiOverview.find('.meili-fullpage__ai-content').html(response.data.overview);
                    } else {
                        this.showAIError(response.data?.message);
                    }
                },
                error: (xhr) => {
                    let message;
                    try {
                        const data = JSON.parse(xhr.responseText);
                        message = data?.data?.message;
                    } catch (e) {}
                    this.showAIError(message);
                }
            });
        },
        
        showAIError(message) {
            this.$aiOverview.removeClass('is-loading has-content').addClass('has-error');
            this.$aiOverview.find('.meili-fullpage__ai-content').html(`
                <p class="meili-fullpage__ai-error">${message || 'Unable to generate AI overview'}</p>
                <button type="button" class="meili-fullpage__ai-retry">Try Again</button>
            `);
        },
        
        // Render results
        renderResults(append = false) {
            this.selectedIndex = -1;
            
            if (this.results.length === 0) {
                this.$aiOverview.hide();
                this.$results.html(`
                    <div class="meili-fullpage__no-results">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                            <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="currentColor" stroke-width="1.5"/>
                            <path d="M21 21L16.8 16.8" stroke="currentColor" stroke-width="1.5"/>
                        </svg>
                        <h3>No results found for "${this.escapeHtml(this.currentQuery)}"</h3>
                        <p>Try different keywords or check your spelling</p>
                    </div>
                `);
                return;
            }
            
            const resultsHtml = this.results.map((hit, index) => this.getResultHtml(hit, index)).join('');
            
            const loadedCount = this.results.length;
            const hasMore = loadedCount < this.totalHits;
            
            const footerHtml = hasMore ? `
                <div class="meili-fullpage__load-more-wrap">
                    <button class="meili-fullpage__load-more">Load more results</button>
                    <span class="meili-fullpage__count">${loadedCount} of ${this.totalHits} results</span>
                </div>
            ` : `
                <div class="meili-fullpage__results-end">
                    <span>${this.totalHits} result${this.totalHits !== 1 ? 's' : ''}</span>
                </div>
            `;
            
            if (append) {
                this.$results.find('.meili-fullpage__load-more-wrap, .meili-fullpage__results-end').remove();
                this.$results.find('.meili-fullpage__results-grid').append(
                    this.results.slice(-this.resultsPerPage).map((hit, i) => 
                        this.getResultHtml(hit, this.results.length - this.resultsPerPage + i)
                    ).join('')
                );
                this.$results.append(footerHtml);
            } else {
                this.$results.html(`
                    <div class="meili-fullpage__results-header">
                        <h2>${this.totalHits} result${this.totalHits !== 1 ? 's' : ''} for "${this.escapeHtml(this.currentQuery)}"</h2>
                    </div>
                    <div class="meili-fullpage__results-grid">
                        ${resultsHtml}
                    </div>
                    ${footerHtml}
                `);
            }
        },
        
        // Get result HTML
        getResultHtml(hit, index) {
            const title = hit._formatted?.title || hit.title || 'Untitled';
            const url = this.getResultUrl(hit);
            const type = this.getResultType(hit);
            const typeClass = this.getTypeClass(hit);
            
            const rawExcerpt = hit._formatted?.excerpt || hit.excerpt || 
                              hit._formatted?.strippedContent || hit.strippedContent || '';
            const excerpt = this.truncateText(this.stripTags(rawExcerpt, '<mark>'), 160);
            
            const thumbnail = hit.featured_media_url || hit.thumbnail || hit.featured_image;
            const thumbUrl = thumbnail ? this.getResultUrl({ link: thumbnail }) : '';
            
            return `
                <article class="meili-fullpage__result ${typeClass}" data-url="${url}" data-index="${index}">
                    ${thumbUrl ? `
                        <div class="meili-fullpage__result-image">
                            <img src="${thumbUrl}" alt="" loading="lazy" />
                        </div>
                    ` : ''}
                    <div class="meili-fullpage__result-body">
                        <span class="meili-fullpage__result-type">${type}</span>
                        <h3 class="meili-fullpage__result-title">
                            <a href="${url}">${title}</a>
                        </h3>
                        ${excerpt ? `<p class="meili-fullpage__result-excerpt">${excerpt}</p>` : ''}
                    </div>
                </article>
            `;
        },
        
        getResultUrl(result) {
            let url = result.link || result.url || result.permalink || '#';
            
            const sourceDomains = [
                'ross-video-2023.local',
                'ross-video-dev.local',
                'rossvideo.com',
                'www.rossvideo.com',
                'rossvideo20dev.wpengine.com',
                'rossvideo20staging.wpengine.com'
            ];
            
            sourceDomains.forEach(domain => {
                if (url.includes(domain)) {
                    url = url.replace(new RegExp(`https?://[^/]*${domain.replace('.', '\\.')}`), window.location.origin);
                }
            });
            
            return url;
        },
        
        getResultType(result) {
            const typeMap = {
                'product': 'Product',
                'post': 'Blog',
                'page': 'Page',
                'industries': 'Industry',
                'use_cases': 'Use Case',
                'case_studies': 'Case Study',
                'news_releases': 'News',
                'u_tutorials': 'Tutorial',
                'resource': 'Resource',
                'events': 'Event',
                'pdf_documents': 'Document',
                'product_resources': 'Resource',
                'partners': 'Partner',
            };
            
            const type = result._index || result.post_type || result.type || '';
            return typeMap[type] || (type ? type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ') : 'Content');
        },
        
        getTypeClass(result) {
            const type = result._index || result.post_type || result.type || '';
            return `type-${type.replace(/_/g, '-')}`;
        },
        
        showError() {
            this.$aiOverview.hide();
            this.$results.html(`
                <div class="meili-fullpage__error">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
                        <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    <h3>Search unavailable</h3>
                    <p>Please try again later</p>
                </div>
            `);
        },
        
        loadMore() {
            this.currentPage++;
            
            const $btn = this.$results.find('.meili-fullpage__load-more');
            $btn.prop('disabled', true).html(`
                <span class="meili-fullpage__spinner-small"></span>
                Loading...
            `);
            
            this.search(true);
        },
        
        // Utilities
        stripTags(str, allowedTags = '') {
            if (!str) return '';
            const allowed = allowedTags.toLowerCase().match(/<[a-z][a-z0-9]*>/g) || [];
            const tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
            
            return str.replace(tags, (match, tag) => {
                return allowed.includes('<' + tag.toLowerCase() + '>') ? match : '';
            });
        },
        
        truncateText(str, length) {
            if (!str) return '';
            str = str.replace(/\s+/g, ' ').trim();
            if (str.length <= length) return str;
            return str.substring(0, length).trim() + '...';
        },
        
        escapeHtml(str) {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }
    };
    
    // Initialize
    $(document).ready(function() {
        FullPageSearch.init();
        
        $(window).on('popstate', function() {
            if (FullPageSearch.isOpen) {
                FullPageSearch.close();
            }
        });
    });
    
    // Export
    window.RossVideoMeili = window.RossVideoMeili || {};
    window.RossVideoMeili.FullPageSearch = FullPageSearch;
    
})(jQuery);
