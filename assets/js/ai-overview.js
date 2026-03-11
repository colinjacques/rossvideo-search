/**
 * AI Overview for Search
 * 
 * Generates AI-powered overviews for search results using Gemini
 * 
 * @package RossVideo
 */

(function($) {
    'use strict';
    
    const AIOverview = {
        // State
        isLoading: false,
        currentQuery: '',
        hasGenerated: false,
        
        // Elements
        $container: null,
        $content: null,
        $loader: null,
        
        /**
         * Initialize the AI Overview
         */
        init() {
            // Check if AI Overview is enabled
            if (typeof rossVideoAIOverview === 'undefined' || !rossVideoAIOverview.enabled) {
                return;
            }
            
            this.$container = $('#ai-overview-container');
            
            if (this.$container.length === 0) {
                return;
            }
            
            this.$content = this.$container.find('.ai-overview-content');
            this.$loader = this.$container.find('.ai-overview-loader');
            
            this.bindEvents();
            this.loadInitialOverview();
        },
        
        /**
         * Bind event listeners
         */
        bindEvents() {
            // Listen for search START - show loading immediately (synced with search results)
            $(document).on('rossvideo:search:start', (e, data) => {
                if (data && data.query) {
                    // Reset state and show loading immediately
                    if (data.query !== this.currentQuery) {
                        this.hasGenerated = false;
                    }
                    this.currentQuery = data.query;
                    this.showLoading();
                }
            });
            
            // Listen for search COMPLETE - generate the overview
            $(document).on('rossvideo:search:complete', (e, data) => {
                if (data && data.query) {
                    // Reset hasGenerated if query changed to allow regeneration
                    if (data.query !== this.currentQuery) {
                        this.hasGenerated = false;
                        this.currentQuery = data.query;
                    }
                    this.generateOverview(data.query, data.hits || []);
                }
            });
            
            // Retry button
            this.$container.on('click', '.ai-overview-retry', () => {
                this.hasGenerated = false;
                this.loadInitialOverview();
            });
            
            // Collapse/expand toggle
            this.$container.on('click', '.ai-overview-toggle', () => {
                this.$container.toggleClass('collapsed');
                const $icon = this.$container.find('.ai-overview-toggle-icon');
                $icon.text(this.$container.hasClass('collapsed') ? '+' : '−');
            });
        },
        
        /**
         * Load initial overview from URL query
         */
        loadInitialOverview() {
            const urlParams = new URLSearchParams(window.location.search);
            const query = urlParams.get('s') || '';
            
            if (query && !this.hasGenerated) {
                // Wait for Meilisearch results first
                this.waitForSearchResults(query);
            }
        },
        
        /**
         * Wait for search results to be available
         */
        waitForSearchResults(query) {
            // Check if RossVideoMeili is available
            if (typeof window.RossVideoMeili === 'undefined' || typeof window.RossVideoMeili.SearchPage === 'undefined') {
                // Fall back to fetching results ourselves
                this.fetchResultsAndGenerate(query);
                return;
            }
            
            // Wait a bit for Meilisearch to load results
            setTimeout(() => {
                // Try to get results from DOM
                const results = this.extractResultsFromDOM();
                
                if (results.length > 0) {
                    this.generateOverview(query, results);
                } else {
                    // Fetch results ourselves
                    this.fetchResultsAndGenerate(query);
                }
            }, 500);
        },
        
        /**
         * Extract search results from DOM
         */
        extractResultsFromDOM() {
            const results = [];
            
            $('.meili-search-result, .results-group-wrapper article').each(function() {
                const $item = $(this);
                const title = $item.find('h4').text().trim();
                const excerpt = $item.find('p').text().trim();
                const type = $item.closest('.results-group-wrapper').data('container') || 'content';
                
                if (title) {
                    results.push({
                        title: title,
                        excerpt: excerpt,
                        post_type: type,
                    });
                }
            });
            
            return results;
        },
        
        /**
         * Fetch results from Meilisearch and generate overview
         */
        async fetchResultsAndGenerate(query) {
            if (!query) return;
            
            this.showLoading();
            
            try {
                // Check if MeiliClient is available
                if (typeof window.RossVideoMeili !== 'undefined' && window.RossVideoMeili.MeiliClient) {
                    const { MeiliClient } = window.RossVideoMeili;
                    
                    const response = await fetch(`${MeiliClient.host}/multi-search`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${MeiliClient.apiKey}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            queries: MeiliClient.indexes.map(indexUid => ({
                                indexUid,
                                q: query,
                                limit: 5,
                            }))
                        }),
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        const hits = MeiliClient.combineResults(data);
                        this.generateOverview(query, hits);
                        return;
                    }
                }
                
                // Fallback: use AJAX endpoint
                this.generateOverviewViaAjax(query, []);
            } catch (error) {
                console.error('Error fetching search results:', error);
                this.showError();
            }
        },
        
        /**
         * Generate AI overview for the given query and results
         */
        generateOverview(query, results) {
            if (this.isLoading || query === this.currentQuery && this.hasGenerated) {
                return;
            }
            
            this.currentQuery = query;
            this.generateOverviewViaAjax(query, results);
        },
        
        /**
         * Generate overview via AJAX
         */
        generateOverviewViaAjax(query, results) {
            this.isLoading = true;
            this.showLoading();
            
            // Prepare results for sending (limit data size)
            const preparedResults = results.slice(0, 10).map(result => {
                // Get the URL from various possible fields
                let url = result.link || result.url || result.permalink || '';
                // Transform URL to current domain if needed
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
                    query: query,
                    results: preparedResults,
                },
                success: (response) => {
                    if (response.success && response.data.overview) {
                        this.showOverview(response.data.overview);
                        this.hasGenerated = true;
                    } else {
                        this.showError(response.data?.message);
                    }
                },
                error: (xhr, status, error) => {
                    console.error('AI Overview error:', error);
                    this.showError();
                },
                complete: () => {
                    this.isLoading = false;
                }
            });
        },
        
        /**
         * Show loading state
         */
        showLoading() {
            this.$container.removeClass('has-error has-content').addClass('is-loading');
            this.$loader.html(`
                <div class="ai-overview-spinner"></div>
                <span>${rossVideoAIOverview.strings.generating}</span>
            `);
            this.$content.empty();
        },
        
        /**
         * Show the generated overview
         */
        showOverview(overview) {
            this.$container.removeClass('is-loading has-error').addClass('has-content');
            this.$content.html(overview);
        },
        
        /**
         * Show error state
         */
        showError(message) {
            this.$container.removeClass('is-loading has-content').addClass('has-error');
            this.$content.html(`
                <p class="ai-overview-error-message">${message || rossVideoAIOverview.strings.error}</p>
                <button type="button" class="btn btn-sm btn-outline-secondary ai-overview-retry">
                    Try Again
                </button>
            `);
        }
    };
    
    // Initialize on DOM ready
    $(document).ready(function() {
        // Only initialize on search page
        if ($('body').hasClass('search') || $('.block_DATA005').length) {
            AIOverview.init();
        }
    });
    
    // Export for external access
    window.RossVideoAIOverview = AIOverview;
    
})(jQuery);
