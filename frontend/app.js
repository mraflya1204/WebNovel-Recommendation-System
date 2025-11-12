document.addEventListener('DOMContentLoaded', () => {

    // === Konfigurasi & Variabel Global ===
    const API_BASE_URL = 'http://127.0.0.1:5001/api';
    
    // Variabel untuk menyimpan instance chart
    let topGenresChart, topTagsChart, novelsPerYearChart;
    
    // Variabel untuk pagination (terpisah untuk setiap tab)
    let searchResults = [];
    let recommendResults = [];
    let chatResults = [];
    let currentSearchPage = 1;
    let currentRecommendPage = 1;
    let currentChatPage = 1;
    const itemsPerPage = 9;
    
    // Template HTML untuk spinner
    const SPINNER_BUTTON_HTML = `<div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> Loading...`;
    const SPINNER_LOADING_HTML = `
        <div class="flex flex-col justify-center items-center p-10 text-gray-500">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            <span class="text-gray-500 ml-3 mt-3">Fetching data...</span>
        </div>`;

    const notificationContainer = document.getElementById('notification-container');

    // === Fungsi Helper ===

    function showNotification(message, type = 'error') {
        const colors = type === 'error' 
            ? 'bg-red-500 border-red-600' 
            : 'bg-green-500 border-green-600';
        
        const notification = document.createElement('div');
        notification.className = `p-4 text-white rounded-lg shadow-lg border-l-4 ${colors} transition-all duration-300 ease-in-out transform translate-x-10 opacity-0`;
        notification.innerHTML = `
            <p class="font-semibold">${type === 'error' ? 'Error' : 'Success'}</p>
            <p>${message}</p>
        `;
        
        notificationContainer.appendChild(notification);

        setTimeout(() => {
            notification.classList.remove('translate-x-10', 'opacity-0');
            notification.classList.add('translate-x-0', 'opacity-100');
        }, 10);

        setTimeout(() => {
            notification.classList.add('opacity-0', 'translate-x-10');
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }

    async function fetchApi(endpoint, options = {}) {
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Network response was not ok (status: ${response.status})`);
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching API:', error);
            showNotification(error.message || `Failed to fetch API endpoint: ${endpoint}`, 'error');
            throw error;
        }
    }

    // === Tab Switching ===
    
    function switchView(view) {
        // Update tabs
        document.querySelectorAll('.tab-button').forEach(btn => {
            const btnView = btn.id.replace('tab-', '');
            if (btnView === view) {
                btn.classList.remove('text-gray-600', 'hover:text-gray-900', 'hover:bg-gray-50');
                btn.classList.add('text-teal-600', 'border-b-2', 'border-teal-600', 'bg-teal-50');
            } else {
                btn.classList.remove('text-teal-600', 'border-b-2', 'border-teal-600', 'bg-teal-50');
                btn.classList.add('text-gray-600', 'hover:text-gray-900', 'hover:bg-gray-50');
            }
        });

        // Update views
        document.querySelectorAll('.view-content').forEach(v => v.classList.add('hidden'));
        document.getElementById(`view-${view}`).classList.remove('hidden');

        // Load dashboard charts if switching to dashboard
        if (view === 'dashboard') {
            loadDashboardData();
        }
    }

    // === Novel Card Creation ===
    
    function createNovelCard(novel) {
        const card = document.createElement('div');
        card.className = 'bg-white p-5 rounded-lg shadow-sm border border-gray-100 hover:shadow-lg hover:border-teal-300 transition-all duration-200';
        
        const novelTitle = novel.title || novel.recommendation || novel.name || 'Unknown Title';
        const reason = novel.reason || (novel.reasonScore ? `Shared ${novel.reasonScore} tags` : null);
        const reasonBadge = reason 
            ? `<span class="inline-block bg-teal-100 text-teal-800 text-xs font-semibold px-3 py-1 rounded-full mt-2">${reason}</span>` 
            : '';
        const details = novel.year 
            ? `<p class="text-sm text-gray-500 mt-1">${novel.year} | ${novel.language || 'N/A'}</p>` 
            : '';

        card.innerHTML = `
            <div class="flex justify-between items-start gap-3">
                <div>
                    <h4 class="text-lg font-semibold text-teal-700">${novelTitle}</h4>
                    ${details}
                    ${reasonBadge}
                </div>
            </div>
        `;
        
        return card;
    }

    // === Pagination ===
    
    function createPagination(totalItems, currentPage, container, onPageChange) {
        container.innerHTML = '';
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        
        if (totalPages <= 1) return;

        const pagination = document.createElement('div');
        pagination.className = 'flex gap-2 justify-center';

        // Previous button
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '← Prev';
        prevBtn.className = `px-4 py-2 rounded-md ${currentPage === 1 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`;
        prevBtn.disabled = currentPage === 1;
        prevBtn.addEventListener('click', () => onPageChange(currentPage - 1));
        pagination.appendChild(prevBtn);

        // Page numbers with smart ellipsis
        let pagesToShow = [1, totalPages, currentPage, currentPage - 1, currentPage + 1];
        pagesToShow = [...new Set(pagesToShow.filter(p => p > 0 && p <= totalPages))].sort((a,b) => a-b);
        
        let lastPage = 0;
        for (const page of pagesToShow) {
            if (lastPage !== 0 && page - lastPage > 1) {
                const dots = document.createElement('span');
                dots.textContent = '...';
                dots.className = 'px-2 py-2 text-gray-500';
                pagination.appendChild(dots);
            }
            const pageBtn = document.createElement('button');
            pageBtn.textContent = page;
            pageBtn.className = `px-4 py-2 rounded-md ${page === currentPage ? 'bg-teal-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`;
            pageBtn.addEventListener('click', () => onPageChange(page));
            pagination.appendChild(pageBtn);
            lastPage = page;
        }

        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Next →';
        nextBtn.className = `px-4 py-2 rounded-md ${currentPage === totalPages ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`;
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.addEventListener('click', () => onPageChange(currentPage + 1));
        pagination.appendChild(nextBtn);

        container.appendChild(pagination);
    }

    // === Display Results ===
    
    function displaySearchResults(data, page = 1) {
        searchResults = data;
        currentSearchPage = page;
        
        const grid = document.getElementById('search-results-grid');
        const container = document.getElementById('search-results');
        const countEl = document.getElementById('search-results-count');
        
        grid.innerHTML = '';
        countEl.textContent = searchResults.length;
        container.classList.remove('hidden');

        if (searchResults.length === 0) {
            grid.innerHTML = `
                <div class="bg-white p-10 rounded-lg shadow-sm border border-gray-100 text-center">
                    <svg class="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    <h3 class="mt-2 text-lg font-medium text-gray-900">No Results Found</h3>
                    <p class="mt-1 text-sm text-gray-500">We couldn't find any novels matching your search.</p>
                </div>
            `;
            return;
        }

        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageResults = searchResults.slice(start, end);

        pageResults.forEach(novel => {
            grid.appendChild(createNovelCard(novel));
        });

        createPagination(searchResults.length, page, document.getElementById('search-pagination'), (newPage) => displaySearchResults(searchResults, newPage));
    }

    function displayRecommendations(data, page = 1) {
        recommendResults = data;
        currentRecommendPage = page;
        
        const grid = document.getElementById('recommend-results-grid');
        const container = document.getElementById('recommend-results');
        const countEl = document.getElementById('recommend-results-count');
        
        grid.innerHTML = '';
        countEl.textContent = recommendResults.length;
        container.classList.remove('hidden');

        if (recommendResults.length === 0) {
            grid.innerHTML = `
                <div class="bg-white p-10 rounded-lg shadow-sm border border-gray-100 text-center">
                    <svg class="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    <h3 class="mt-2 text-lg font-medium text-gray-900">No Recommendations Found</h3>
                    <p class="mt-1 text-sm text-gray-500">We couldn't find any recommendations.</p>
                </div>
            `;
            return;
        }

        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageResults = recommendResults.slice(start, end);

        pageResults.forEach(novel => {
            grid.appendChild(createNovelCard(novel));
        });

        createPagination(recommendResults.length, page, document.getElementById('recommend-pagination'), (newPage) => displayRecommendations(recommendResults, newPage));
    }

    function displayChatResults(data, page = 1) {
        chatResults = data;
        currentChatPage = page;
        
        const grid = document.getElementById('chat-results-grid');
        const container = document.getElementById('chat-results');
        const countEl = document.getElementById('chat-results-count');
        
        grid.innerHTML = '';
        countEl.textContent = chatResults.length;
        container.classList.remove('hidden');

        if (chatResults.length === 0) {
            grid.innerHTML = `
                <div class="bg-white p-10 rounded-lg shadow-sm border border-gray-100 text-center">
                    <svg class="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <h3 class="mt-2 text-lg font-medium text-gray-900">No Results Found</h3>
                    <p class="mt-1 text-sm text-gray-500">AI couldn't find any novels matching your query.</p>
                </div>
            `;
            return;
        }

        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageResults = chatResults.slice(start, end);

        pageResults.forEach(novel => {
            grid.appendChild(createNovelCard(novel));
        });

        createPagination(chatResults.length, page, document.getElementById('chat-pagination'), (newPage) => displayChatResults(chatResults, newPage));
    }

    // === Dashboard Charts ===
    
    function getChartElements(canvasId) {
        const canvas = document.getElementById(canvasId);
        const container = canvas.closest('.chart-container');
        const overlay = container.querySelector('.loading-overlay');
        return { canvas, container, overlay };
    }

    function createOrUpdateChart(chartInstance, canvasId, chartType, data, options) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        if (chartInstance) {
            chartInstance.destroy();
        }
        return new Chart(ctx, {
            type: chartType,
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                ...options
            }
        });
    }

    function renderTopGenresChart(data, isLoading = false, errorMsg = null) {
        const { overlay } = getChartElements('top-genres-chart');
        if (isLoading) {
            overlay.innerHTML = SPINNER_LOADING_HTML;
            overlay.classList.remove('hidden');
            return;
        }
        if (errorMsg) {
            overlay.innerHTML = `<p class="text-red-500 text-center p-4">${errorMsg}</p>`;
            overlay.classList.remove('hidden');
            return;
        }
        overlay.classList.add('hidden');

        const chartData = {
            labels: data.map(d => d.name),
            datasets: [{
                label: 'Novel Count',
                data: data.map(d => d.novelCount),
                backgroundColor: 'rgba(20, 184, 166, 0.7)',
                borderColor: 'rgba(15, 118, 110, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        };
        const options = {
            scales: { y: { beginAtZero: true } },
            plugins: { legend: { display: false } }
        };
        
        topGenresChart = createOrUpdateChart(topGenresChart, 'top-genres-chart', 'bar', chartData, options);
    }
    
    function renderTopTagsChart(data, isLoading = false, errorMsg = null) {
        const { overlay } = getChartElements('top-tags-chart');
        if (isLoading) {
            overlay.innerHTML = SPINNER_LOADING_HTML;
            overlay.classList.remove('hidden');
            return;
        }
        if (errorMsg) {
            overlay.innerHTML = `<p class="text-red-500 text-center p-4">${errorMsg}</p>`;
            overlay.classList.remove('hidden');
            return;
        }
        overlay.classList.add('hidden');

        const chartData = {
            labels: data.map(d => d.name),
            datasets: [{
                label: 'Novel Count',
                data: data.map(d => d.novelCount),
                backgroundColor: 'rgba(59, 130, 246, 0.7)',
                borderColor: 'rgba(37, 99, 235, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        };
        const options = {
            indexAxis: 'y',
            scales: { x: { beginAtZero: true } },
            plugins: { legend: { display: false } }
        };

        topTagsChart = createOrUpdateChart(topTagsChart, 'top-tags-chart', 'bar', chartData, options);
    }
    
    function renderNovelsPerYearChart(data, isLoading = false, errorMsg = null) {
        const { overlay } = getChartElements('novels-per-year-chart');
        if (isLoading) {
            overlay.innerHTML = SPINNER_LOADING_HTML;
            overlay.classList.remove('hidden');
            return;
        }
        if (errorMsg) {
            overlay.innerHTML = `<p class="text-red-500 text-center p-4">${errorMsg}</p>`;
            overlay.classList.remove('hidden');
            return;
        }
        overlay.classList.add('hidden');

        const sortedData = data.filter(d => d.year && d.year > 1990).sort((a, b) => a.year - b.year);
        
        const chartData = {
            labels: sortedData.map(d => d.year),
            datasets: [{
                label: 'Novels Published',
                data: sortedData.map(d => d.novelCount),
                fill: true,
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderColor: 'rgba(99, 102, 241, 1)',
                tension: 0.3
            }]
        };
        const options = {
            scales: { y: { beginAtZero: true } },
            plugins: { legend: { display: false } }
        };
        
        novelsPerYearChart = createOrUpdateChart(novelsPerYearChart, 'novels-per-year-chart', 'line', chartData, options);
    }

    async function loadDashboardData() {
        try {
            renderTopGenresChart(null, true);
            renderTopTagsChart(null, true);
            renderNovelsPerYearChart(null, true);

            const [genresData, tagsData, yearsData] = await Promise.all([
                fetchApi('/stats/top-genres'),
                fetchApi('/stats/top-tags'),
                fetchApi('/stats/novels-per-year')
            ]);
            
            renderTopGenresChart(genresData);
            renderTopTagsChart(tagsData);
            renderNovelsPerYearChart(yearsData);

        } catch (error) {
            console.error("Failed to load dashboard:", error);
            renderTopGenresChart(null, false, "Failed to load data");
            renderTopTagsChart(null, false, "Failed to load data");
            renderNovelsPerYearChart(null, false, "Failed to load data");
        }
    }

    // === Form Handlers ===
    
    // Handler untuk Search Form (dengan dropdown)
    async function handleSearchFormSubmit(e) {
        e.preventDefault();
        
        const submitButton = e.currentTarget.querySelector('button[type="submit"]');
        const searchType = document.getElementById('search-type-select').value;
        const query = document.getElementById('search-query-input').value.trim();
        
        if (!query) {
            showNotification("Search term cannot be empty.", 'error');
            return;
        }

        const originalButtonText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = SPINNER_BUTTON_HTML;

        try {
            const encodedQuery = encodeURIComponent(query);
            const apiEndpoint = `/search/${searchType}/${encodedQuery}`;
            const data = await fetchApi(apiEndpoint);
            
            displaySearchResults(data);
            showNotification(`Found ${data.length} result(s)`, 'success');
        } catch (error) {
            displaySearchResults([]);
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = 'Search';
        }
    }

    // Handler untuk Recommendation Form (dengan dropdown)
    async function handleRecommendFormSubmit(e) {
        e.preventDefault();
        
        const submitButton = e.currentTarget.querySelector('button[type="submit"]');
        const recommendType = document.getElementById('recommend-type-select').value;
        const title = document.getElementById('recommend-title-input').value.trim();
        
        if (!title) {
            showNotification("Novel title cannot be empty.", 'error');
            return;
        }

        const originalButtonText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = SPINNER_BUTTON_HTML;

        try {
            const encodedTitle = encodeURIComponent(title);
            const apiEndpoint = `/recommend/${recommendType}/${encodedTitle}`;
            const data = await fetchApi(apiEndpoint);
            
            displayRecommendations(data);
            showNotification(`Found ${data.length} recommendation(s)`, 'success');
        } catch (error) {
            displayRecommendations([]);
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = 'Get';
        }
    }

    // Handler untuk LLM/Chat Form
    async function handleLlmFormSubmit(e) {
        e.preventDefault();
        
        const submitButton = e.currentTarget.querySelector('button[type="submit"]');
        const inputElement = document.getElementById('llm-query-input');
        const question = inputElement.value.trim();
        
        if (!question) {
            showNotification("Question cannot be empty.", 'error');
            return;
        }

        const originalButtonText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = SPINNER_BUTTON_HTML;

        try {
            const data = await fetchApi('/llm-query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: question })
            });

            if (data.error) {
                showNotification(data.answer || data.error, 'error');
                displayChatResults([]);
            } else {
                displayChatResults(data);
                showNotification(`Found ${data.length} result(s)`, 'success');
            }
        } catch (error) {
            displayChatResults([]);
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
        }
    }

    // === Inisialisasi & Event Listeners ===
    
    function initialize() {
        // Tab listeners
        document.getElementById('tab-dashboard').addEventListener('click', () => switchView('dashboard'));
        document.getElementById('tab-search').addEventListener('click', () => switchView('search'));
        document.getElementById('tab-recommend').addEventListener('click', () => switchView('recommend'));
        document.getElementById('tab-chat').addEventListener('click', () => switchView('chat'));

        // Form listeners
        document.getElementById('form-search-single').addEventListener('submit', handleSearchFormSubmit);
        document.getElementById('form-recommend-single').addEventListener('submit', handleRecommendFormSubmit);
        document.getElementById('form-llm-query').addEventListener('submit', handleLlmFormSubmit);

        // Load initial dashboard
        loadDashboardData();
    }

    // Jalankan aplikasi
    initialize();
});