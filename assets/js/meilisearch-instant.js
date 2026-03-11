/**
 * Meilisearch Instant Search
 * 
 * Provides real-time search with autocomplete for header search
 * and any search input with .meili-search-input class
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
    
    // Meilisearch client for direct API calls
    const MeiliClient = {
        host: rossVideoMeili.host,
        apiKey: rossVideoMeili.apiKey,
        indexes: rossVideoMeili.indexes,
        
        async search(query, options = {}) {
            const defaults = {
                limit: 8,
                attributesToRetrieve: ['id', 'title', 'link', 'featured_media_url', 'excerpt', 'strippedContent', 'post_type', '_index', 'thumbnail', 'featured_image'],
                attributesToHighlight: ['title'],
                highlightPreTag: '<mark>',
                highlightPostTag: '</mark>',
            };
            
            const searchParams = { ...defaults, ...options, q: query };
            
            // Multi-index search
            const queries = this.indexes.map(indexUid => ({
                indexUid,
                ...searchParams
            }));
            
            try {
                const response = await fetch(`${this.host}/multi-search`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
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
        
        combineResults(response) {
            if (!response || !response.results) return [];
            
            const allHits = [];
            response.results.forEach(result => {
                if (result.hits) {
                    result.hits.forEach(hit => {
                        allHits.push({
                            ...hit,
                            _index: result.indexUid,
                        });
                    });
                }
            });
            
            // Sort by ranking score if available
            allHits.sort((a, b) => (b._rankingScore || 0) - (a._rankingScore || 0));
            
            return allHits;
        }
    };
    
    // Instant Search Widget
    class InstantSearch {
        constructor(inputElement, options = {}) {
            this.$input = $(inputElement);
            this.$form = this.$input.closest('form');
            this.options = {
                minChars: 2,
                debounceMs: 400,
                maxResults: 8,
                showType: true,
                ...options
            };
            
            this.isOpen = false;
            this.$dropdown = null;
            this.selectedIndex = -1;
            this.results = [];
            
            this.init();
        }
        
        init() {
            this.createDropdown();
            this.bindEvents();
        }
        
        createDropdown() {
            this.$dropdown = $(`
                <div class="meili-instant-dropdown">
                    <div class="meili-instant-results"></div>
                    <div class="meili-instant-footer">
                        <a href="#" class="meili-view-all">
                            ${rossVideoMeili.strings.viewAll}
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </a>
                    </div>
                </div>
            `);
            
            // Position relative to input
            this.$input.parent().css('position', 'relative');
            this.$dropdown.insertAfter(this.$input);
        }
        
        bindEvents() {
            // Input events
            this.$input.on('input', debounce((e) => {
                this.handleInput(e.target.value);
            }, this.options.debounceMs));
            
            this.$input.on('focus', () => {
                if (this.results.length > 0) {
                    this.open();
                }
            });
            
            // Keyboard navigation
            this.$input.on('keydown', (e) => {
                this.handleKeydown(e);
            });
            
            // Click outside to close
            $(document).on('click', (e) => {
                if (!$(e.target).closest('.meili-instant-dropdown, .meili-search-input, #search').length) {
                    this.close();
                }
            });
            
            // Prevent form submission if dropdown is open and item is selected
            this.$form.on('submit', (e) => {
                if (this.isOpen && this.selectedIndex >= 0 && this.results[this.selectedIndex]) {
                    e.preventDefault();
                    window.location.href = this.getResultUrl(this.results[this.selectedIndex]);
                }
            });
            
            // View all link
            this.$dropdown.on('click', '.meili-view-all', (e) => {
                e.preventDefault();
                const query = this.$input.val();
                if (query) {
                    window.location.href = rossVideoMeili.searchPageUrl + encodeURIComponent(query);
                }
            });
            
            // Result click
            this.$dropdown.on('click', '.meili-instant-result', (e) => {
                const url = $(e.currentTarget).data('url');
                if (url) {
                    window.location.href = url;
                }
            });
        }
        
        async handleInput(query) {
            if (query.length < this.options.minChars) {
                this.close();
                this.results = [];
                return;
            }
            
            this.showLoading();
            
            const response = await MeiliClient.search(query, {
                limit: this.options.maxResults,
            });
            
            if (response) {
                this.results = MeiliClient.combineResults(response);
                this.render();
                this.open();
            } else {
                this.showError();
            }
        }
        
        handleKeydown(e) {
            if (!this.isOpen) return;
            
            switch (e.keyCode) {
                case 40: // Down
                    e.preventDefault();
                    this.navigate(1);
                    break;
                case 38: // Up
                    e.preventDefault();
                    this.navigate(-1);
                    break;
                case 13: // Enter
                    if (this.selectedIndex >= 0) {
                        e.preventDefault();
                        const result = this.results[this.selectedIndex];
                        if (result) {
                            window.location.href = this.getResultUrl(result);
                        }
                    }
                    break;
                case 27: // Escape
                    this.close();
                    break;
            }
        }
        
        navigate(direction) {
            const maxIndex = this.results.length - 1;
            this.selectedIndex += direction;
            
            if (this.selectedIndex < 0) {
                this.selectedIndex = maxIndex;
            } else if (this.selectedIndex > maxIndex) {
                this.selectedIndex = 0;
            }
            
            this.updateSelection();
        }
        
        updateSelection() {
            this.$dropdown.find('.meili-instant-result')
                .removeClass('selected')
                .eq(this.selectedIndex)
                .addClass('selected');
        }
        
        getResultUrl(result) {
            // Get URL from available fields (Meilisearch uses 'link')
            let url = result.link || result.url || result.permalink || '#';
            
            // Transform URL for current environment
            const currentHost = window.location.hostname;
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
            
            return url;
        }
        
        getResultType(result) {
            const typeMap = {
                // WordPress post types
                'product': 'Product',
                'post': 'Blog',
                'industries': 'Industry',
                'use_cases': 'Use Case',
                'case_studies': 'Case Study',
                'news_releases': 'News',
                'u_tutorials': 'Tutorial',
                'resource': 'Resource',
                'events': 'Event',
                // Meilisearch index names
                'page': 'Page',
                'pdf_documents': 'Document',
                'product_resources': 'Resource',
                'partners': 'Partner',
            };
            
            // Use post_type, _index (Meilisearch index name), or type field
            const type = result.post_type || result._index || result.type || '';
            return typeMap[type] || (type ? type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ') : '');
        }
        
        render() {
            const $results = this.$dropdown.find('.meili-instant-results');
            
            if (this.results.length === 0) {
                $results.html(`<div class="meili-no-results">${rossVideoMeili.strings.noResults}</div>`);
                this.$dropdown.find('.meili-instant-footer').hide();
                return;
            }
            
            this.$dropdown.find('.meili-instant-footer').show();
            
            const html = this.results.slice(0, this.options.maxResults).map((result, index) => {
                const title = result._formatted?.title || result.title || 'Untitled';
                const url = this.getResultUrl(result);
                const type = this.options.showType ? `<span class="meili-result-type">${this.getResultType(result)}</span>` : '';
                // Use featured_media_url (Meilisearch field name)
                const thumbnail = result.featured_media_url || result.thumbnail || result.featured_image;
                const thumbUrl = thumbnail ? this.getResultUrl({link: thumbnail}) : '';
                const thumbHtml = thumbUrl ? `<div class="meili-result-thumb"><img src="${thumbUrl}" alt="" loading="lazy"></div>` : '';
                
                // Get excerpt - prefer WordPress excerpt field, fallback to strippedContent
                const rawExcerpt = result._formatted?.excerpt || result.excerpt || 
                                   result._formatted?.strippedContent || result.strippedContent || '';
                const cleanExcerpt = rawExcerpt.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
                const excerpt = cleanExcerpt.length > 100 ? cleanExcerpt.substring(0, 100).trim() + '...' : cleanExcerpt;
                const excerptHtml = excerpt ? `<div class="meili-result-excerpt">${excerpt}</div>` : '';
                
                return `
                    <div class="meili-instant-result${index === this.selectedIndex ? ' selected' : ''}" data-url="${url}" data-index="${index}">
                        ${thumbHtml}
                        <div class="meili-result-content">
                            ${type}
                            <div class="meili-result-title">${title}</div>
                            ${excerptHtml}
                        </div>
                    </div>
                `;
            }).join('');
            
            $results.html(html);
            this.selectedIndex = -1;
        }
        
        showLoading() {
            this.$dropdown.find('.meili-instant-results').html(`
                <div class="meili-loading">
                    <span class="meili-spinner"></span>
                    ${rossVideoMeili.strings.searching}
                </div>
            `);
            this.open();
        }
        
        showError() {
            this.$dropdown.find('.meili-instant-results').html(`
                <div class="meili-no-results">Search unavailable</div>
            `);
        }
        
        open() {
            this.isOpen = true;
            this.$dropdown.addClass('is-open');
            $('body').addClass('meili-dropdown-open');
        }
        
        close() {
            this.isOpen = false;
            this.$dropdown.removeClass('is-open');
            $('body').removeClass('meili-dropdown-open');
            this.selectedIndex = -1;
        }
    }
    
    // Initialize on DOM ready
    $(document).ready(function() {
        // Initialize for header search
        const $headerSearch = $('header #search, header input[name="s"]');
        if ($headerSearch.length) {
            $headerSearch.each(function() {
                new InstantSearch(this);
            });
        }
        
        // Initialize for any element with meili-search-input class
        $('.meili-search-input').each(function() {
            new InstantSearch(this);
        });
        
        // Initialize for search bar blocks
        $('.block_SB001 input[name="s"]').each(function() {
            new InstantSearch(this);
        });
    });
    
    // Export for external use
    window.RossVideoMeili = {
        InstantSearch,
        MeiliClient,
    };
    
})(jQuery);
