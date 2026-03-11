/**
 * Meilisearch Search Page
 * 
 * Full search page functionality with filters and pagination
 * 
 * @package RossVideo
 */

(function($) {
    'use strict';
    
    const SearchPage = {
        // State
        currentQuery: '',
        currentFilters: [],
        currentPage: 0,
        resultsPerPage: 20,
        isLoading: false,
        totalHits: 0,
        
        // Elements
        $resultsContainer: null,
        $filterCheckboxes: null,
        $searchInput: null,
        $paginationInfo: null,
        $loadMoreBtn: null,
        
        init() {
            this.$resultsContainer = $('.block_DATA005 .posts-list, .meili-search-results');
            this.$filterCheckboxes = $('.block_DATA005 .form-check-input, .meili-filter-checkbox');
            this.$searchInput = $('.block_DATA005 input[name="s"], .meili-search-input');
            this.$paginationInfo = $('.block_DATA005 .pagination-data, .meili-pagination-info');
            
            this.bindEvents();
            this.loadInitialResults();
        },
        
        bindEvents() {
            // Filter changes
            this.$filterCheckboxes.on('change', () => {
                this.currentPage = 0;
                this.search();
            });
            
            // Search input (with debounce - wait for user to stop typing)
            let searchTimeout;
            this.$searchInput.on('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.currentQuery = e.target.value;
                    this.currentPage = 0;
                    this.search();
                }, 1200);
            });
            
            // Search button
            $('#input_search, .meili-search-btn').on('click', (e) => {
                e.preventDefault();
                this.currentQuery = this.$searchInput.val();
                this.currentPage = 0;
                this.search();
            });
            
            // Reset filters
            $('[onclick*="resetFilters"], .meili-reset-filters').on('click', (e) => {
                e.preventDefault();
                this.$filterCheckboxes.prop('checked', false);
                this.currentFilters = [];
                this.currentPage = 0;
                this.search();
            });
            
            // Load more
            $(document).on('click', '.meili-load-more', (e) => {
                e.preventDefault();
                this.loadMore();
            });
        },
        
        getSelectedFilters() {
            const filters = [];
            this.$filterCheckboxes.filter(':checked').each(function() {
                filters.push($(this).val());
            });
            return filters;
        },
        
        loadInitialResults() {
            // Get query from URL
            const urlParams = new URLSearchParams(window.location.search);
            this.currentQuery = urlParams.get('s') || '';
            
            if (this.currentQuery) {
                this.$searchInput.val(this.currentQuery);
                this.search();
            }
        },
        
        async search(append = false) {
            if (this.isLoading) return;
            
            this.isLoading = true;
            this.currentFilters = this.getSelectedFilters();
            
            if (!append) {
                this.showLoading();
                // Fire event so AI overview shows loading at the same time
                $(document).trigger('rossvideo:search:start', {
                    query: this.currentQuery
                });
            } else {
                this.showLoadingMore();
            }
            
            try {
                // Direct Meilisearch API call for better performance
                const response = await this.searchMeilisearch();
                
                if (response) {
                    this.totalHits = response.estimatedTotalHits || response.hits.length;
                    this.renderResults(response.hits, append);
                    this.updatePaginationInfo();
                } else {
                    this.showError();
                }
            } catch (error) {
                console.error('Search error:', error);
                this.showError();
            }
            
            this.isLoading = false;
        },
        
        async searchMeilisearch() {
            const { MeiliClient } = window.RossVideoMeili;
            
            const options = {
                limit: this.resultsPerPage,
                offset: this.currentPage * this.resultsPerPage,
                attributesToRetrieve: ['id', 'title', 'link', 'featured_media_url', 'excerpt', 'strippedContent', 'post_type', '_index'],
                attributesToHighlight: ['title', 'excerpt', 'strippedContent'],
                highlightPreTag: '<mark>',
                highlightPostTag: '</mark>',
            };
            
            // Determine which indexes to search based on filters
            let indexesToSearch = [...MeiliClient.indexes]; // Default: all indexes
            
            if (this.currentFilters.length > 0) {
                // Filter values should match index names directly
                // Get indexes that match the selected filters
                indexesToSearch = this.currentFilters
                    .filter(index => MeiliClient.indexes.includes(index));
                
                // If no valid indexes found, fall back to all
                if (indexesToSearch.length === 0) {
                    indexesToSearch = [...MeiliClient.indexes];
                }
            }
            
            // Search only selected indexes
            const response = await this.searchIndexes(indexesToSearch, this.currentQuery, options);
            
            if (response) {
                return {
                    hits: MeiliClient.combineResults(response),
                    estimatedTotalHits: this.getTotalHits(response),
                };
            }
            
            return null;
        },
        
        async searchIndexes(indexes, query, options = {}) {
            const { MeiliClient } = window.RossVideoMeili;
            
            const queries = indexes.map(indexUid => ({
                indexUid,
                ...options,
                q: query
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
                
                return await response.json();
            } catch (error) {
                console.error('Meilisearch error:', error);
                return null;
            }
        },
        
        getTotalHits(response) {
            if (!response || !response.results) return 0;
            return response.results.reduce((total, result) => {
                return total + (result.estimatedTotalHits || result.totalHits || 0);
            }, 0);
        },
        
        renderResults(hits, append = false) {
            if (!append) {
                this.$resultsContainer.empty();
            }
            
            // Remove load more button before adding new results
            this.$resultsContainer.find('.meili-load-more-wrapper').remove();
            
            // Fire event for AI Overview and other listeners
            if (!append) {
                $(document).trigger('rossvideo:search:complete', {
                    query: this.currentQuery,
                    hits: hits,
                    totalHits: this.totalHits
                });
            }
            
            if (hits.length === 0 && !append) {
                this.$resultsContainer.html(this.getNoResultsHtml());
                return;
            }
            
            // Render results in pure relevance order (no grouping)
            hits.forEach(hit => {
                this.$resultsContainer.append(this.getResultHtml(hit));
            });
            
            // Add load more if there are more results
            const loadedCount = (this.currentPage + 1) * this.resultsPerPage;
            if (loadedCount < this.totalHits) {
                this.$resultsContainer.append(`
                    <div class="meili-load-more-wrapper text-center mt-4">
                        <button class="btn btn-primary meili-load-more">
                            Load More Results
                        </button>
                        <p class="text-small text-muted mt-2">
                            Showing ${Math.min(loadedCount, this.totalHits)} of ${this.totalHits} results
                        </p>
                    </div>
                `);
            }
        },
        
        groupByType(hits) {
            const grouped = {};
            hits.forEach(hit => {
                // Use _index (Meilisearch index name) as the type for grouping
                const type = hit._index || hit.post_type || 'content';
                if (!grouped[type]) {
                    grouped[type] = [];
                }
                grouped[type].push(hit);
            });
            return grouped;
        },
        
        getTypeLabel(type) {
            const labels = {
                // WordPress post types
                'product': 'Products',
                'post': 'Blog',
                'industries': 'Industries',
                'use_cases': 'Use Cases',
                'case_studies': 'Case Studies',
                'news_releases': 'News',
                'u_tutorials': 'Tutorials',
                'resource': 'Resources',
                'events': 'Events',
                // Meilisearch index names
                'page': 'Pages',
                'pdf_documents': 'Documents',
                'product_resources': 'Resources',
                'partners': 'Partners',
            };
            return labels[type] || (type ? type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ') : 'Content');
        },
        
        getResultHtml(hit) {
            const title = hit._formatted?.title || hit.title || 'Untitled';
            // Use 'link' field (Meilisearch field name)
            let url = hit.link || hit.url || hit.permalink || '#';
            
            // Transform URL for current environment
            const sourceDomains = [
                'ross-video-2023.local',
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
            
            // Get content type for badge
            const type = hit._index || hit.post_type || hit.type || '';
            const typeLabel = this.getTypeLabel(type);
            
            // Prefer WordPress excerpt field, fallback to strippedContent
            const excerpt = hit._formatted?.excerpt || hit.excerpt || 
                           hit._formatted?.strippedContent || hit.strippedContent || '';
            const trimmedExcerpt = excerpt ? this.trimWords(this.stripTags(excerpt, '<mark>'), 30) : '';
            
            return `
                <article class="meili-search-result">
                    <a href="${url}" class="hyperlink">
                        <span class="badge badge-secondary text-small mb-2">${typeLabel}</span>
                        <h4 class="text-medium mb-3 color-blue">${title}</h4>
                        ${trimmedExcerpt ? `<p class="text-small mb-0">${trimmedExcerpt}</p>` : ''}
                    </a>
                </article>
                <hr>
            `;
        },
        
        getNoResultsHtml() {
            return `
                <div class="meili-no-results text-center py-5">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="mb-3">
                        <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="#ccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M21 21L16.8 16.8" stroke="#ccc" stroke-width="2" stroke-linejoin="round"/>
                    </svg>
                    <h3 class="text-large mb-2">No results found</h3>
                    <p class="text-medium text-muted">Try different keywords or remove filters</p>
                </div>
            `;
        },
        
        showLoading() {
            this.$resultsContainer.html(`
                <div class="meili-loading-state text-center py-5">
                    <div class="meili-spinner-large mb-3"></div>
                    <p class="text-medium">Searching...</p>
                </div>
            `);
        },
        
        showLoadingMore() {
            const $loadMore = this.$resultsContainer.find('.meili-load-more');
            $loadMore.prop('disabled', true).html('<span class="meili-spinner"></span> Loading...');
        },
        
        showError() {
            this.$resultsContainer.html(`
                <div class="meili-error text-center py-5">
                    <p class="text-medium text-danger">An error occurred while searching. Please try again.</p>
                </div>
            `);
        },
        
        updatePaginationInfo() {
            const loadedCount = Math.min((this.currentPage + 1) * this.resultsPerPage, this.totalHits);
            
            if (this.$paginationInfo.length) {
                this.$paginationInfo.html(`
                    Showing results for "${this.currentQuery}" (${this.totalHits} found)
                `);
            }
        },
        
        loadMore() {
            this.currentPage++;
            this.search(true);
        },
        
        // Utility functions
        stripTags(str, allowedTags = '') {
            const allowed = allowedTags.toLowerCase().match(/<[a-z][a-z0-9]*>/g) || [];
            const tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
            
            return str.replace(tags, (match, tag) => {
                return allowed.includes('<' + tag.toLowerCase() + '>') ? match : '';
            });
        },
        
        trimWords(str, count) {
            const words = str.split(/\s+/);
            if (words.length <= count) return str;
            return words.slice(0, count).join(' ') + '...';
        }
    };
    
    // Initialize on DOM ready
    $(document).ready(function() {
        // Only initialize on search page
        if ($('body').hasClass('search') || $('.block_DATA005').length || $('.meili-search-page').length) {
            SearchPage.init();
        }
    });
    
    // Export
    window.RossVideoMeili = window.RossVideoMeili || {};
    window.RossVideoMeili.SearchPage = SearchPage;
    
})(jQuery);
