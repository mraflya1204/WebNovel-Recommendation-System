document.addEventListener('DOMContentLoaded', () => {

    // === Konfigurasi & Variabel Global ===
    const API_BASE_URL = 'http://127.0.0.1:5001/api';
    
    let topGenresChart, topTagsChart, novelsPerYearChart;
    let currentResults = [];
    let currentPage = 1;
    const itemsPerPage = 10;
    let lastLlmQuestion = '';
    let lastLlmResponse = null;
    
    const SPINNER_BUTTON_HTML = `<div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> Loading...`;
    const SPINNER_LOADING_HTML = `
        <div class="flex flex-col justify-center items-center p-10 text-gray-500">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
            <span class="text-gray-500 ml-3 mt-3">Fetching data...</span>
        </div>`;

    const notificationContainer = document.getElementById('notification-container');

    // === Helper Functions ===

    function showNotification(message, type = 'error') {
        const colors = type === 'error' ? 'bg-red-500 border-red-600' : 'bg-green-500 border-green-600';
        const notification = document.createElement('div');
        notification.className = `p-4 text-white rounded-lg shadow-lg border-l-4 ${colors} transition-all duration-300 ease-in-out transform translate-x-10 opacity-0`;
        notification.innerHTML = `<p class="font-semibold">${type === 'error' ? 'Error' : 'Success'}</p><p>${message}</p>`;
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
            return await response.json();
        } catch (error) {
            console.error('Error fetching API:', error);
            showNotification(error.message || `Failed to fetch API endpoint: ${endpoint}`, 'error');
            throw error;
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // === Tab Switching ===
    
    function switchView(view) {
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

        document.querySelectorAll('.view-content').forEach(v => v.classList.add('hidden'));
        const viewEl = document.getElementById(`view-${view}`);
        if (viewEl) viewEl.classList.remove('hidden');

        if (view === 'dashboard') {
            ['search-results', 'recommend-results', 'chat-results'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add('hidden');
            });
            loadDashboardData();
        }

        const thinkingBtn = document.getElementById('show-thinking-btn');
        const thinkingContainer = document.getElementById('chat-thinking-container');
        const flowchartContainer = document.getElementById('chat-flowchart-container');
        if (thinkingBtn) thinkingBtn.classList.add('hidden');
        if (thinkingContainer) thinkingContainer.classList.add('hidden');
        if (flowchartContainer) flowchartContainer.classList.add('hidden');
    }

    // === Novel Card ===
    
    function createNovelCard(item) {
        if (item.count !== undefined) {
            return `<div class="bg-white p-5 rounded-lg shadow-sm border border-gray-100 text-center">
                <h3 class="text-3xl font-bold text-teal-700">${item.count}</h3>
                <p class="text-sm text-gray-500 mt-1">Total Count</p></div>`;
        }
        if (item.genre) {
            return `<div class="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex items-center">
                <span class="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">${item.genre}</span></div>`;
        }
        if (item.tag) {
            return `<div class="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex items-center">
                <span class="bg-indigo-100 text-indigo-800 text-sm font-medium px-3 py-1 rounded-full">${item.tag}</span></div>`;
        }

        const novelTitle = item.title || item.recommendation || item.name || 'Unknown Title';
        let reasonBadge = '';
        if (item.reason) {
            reasonBadge = `<span class="inline-block bg-teal-100 text-teal-800 text-xs font-semibold px-3 py-1 rounded-full mt-2">${item.reason}</span>`;
        } else if (item.reasonScore) {
            reasonBadge = `<span class="inline-block bg-teal-100 text-teal-800 text-xs font-semibold px-3 py-1 rounded-full mt-2">Score: ${item.reasonScore}</span>`;
        }

        const detailParts = [];
        if (item.year) detailParts.push(item.year);
        if (item.language) detailParts.push(item.language);
        if (item.authorName) detailParts.push(`By: ${item.authorName}`);
        const details = detailParts.length > 0 ? `<p class="text-sm text-gray-500 mt-1">${detailParts.join(' | ')}</p>` : '';

        return `<div class="bg-white p-5 rounded-lg shadow-sm border border-gray-100 hover:shadow-lg hover:border-teal-300 transition-all duration-200">
            <div class="flex justify-between items-start gap-3"><div>
                <h4 class="text-lg font-semibold text-teal-700">${novelTitle}</h4>${details}${reasonBadge}
            </div></div></div>`;
    }

    // === Pagination ===
    
    function createPagination(totalItems, currentPage, container, onPageChange) {
        container.innerHTML = '';
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        if (totalPages <= 1) return;

        const pagination = document.createElement('div');
        pagination.className = 'flex gap-2 justify-center';

        const createBtn = (text, page, isDisabled = false) => {
            const btn = document.createElement('button');
            btn.innerHTML = text;
            btn.className = `px-4 py-2 rounded-md text-sm ${isDisabled ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : page === currentPage ? 'bg-teal-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`;
            btn.disabled = isDisabled;
            if (!isDisabled && page !== currentPage) {
                btn.addEventListener('click', () => onPageChange(page));
            }
            return btn;
        };

        pagination.appendChild(createBtn('← Prev', currentPage - 1, currentPage === 1));

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
            pagination.appendChild(createBtn(page, page));
            lastPage = page;
        }

        pagination.appendChild(createBtn('Next →', currentPage + 1, currentPage === totalPages));
        container.appendChild(pagination);
    }

    // === Display Results ===
    
    function displaySearchResults(data) {
        const grid = document.getElementById('search-results-grid');
        const container = document.getElementById('search-results');
        const countEl = document.getElementById('search-results-count');
        const paginationEl = document.getElementById('search-pagination');
        
        countEl.textContent = data.length;
        container.classList.remove('hidden');

        if (data.length === 0) {
            grid.innerHTML = `<div class="bg-white p-10 rounded-lg shadow-sm border border-gray-100 text-center">
                <svg class="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                <h3 class="mt-2 text-lg font-medium text-gray-900">No Results Found</h3>
                <p class="mt-1 text-sm text-gray-500">We couldn't find any novels matching your search.</p></div>`;
            paginationEl.innerHTML = '';
            return;
        }

        currentResults = data;
        currentPage = 1;
        displayResultsPage(grid, paginationEl, 1);
    }

    function displayRecommendations(data) {
        const grid = document.getElementById('recommend-results-grid');
        const container = document.getElementById('recommend-results');
        const countEl = document.getElementById('recommend-results-count');
        const paginationEl = document.getElementById('recommend-pagination');
        
        countEl.textContent = data.length;
        container.classList.remove('hidden');

        if (data.length === 0) {
            grid.innerHTML = `<div class="bg-white p-10 rounded-lg shadow-sm border border-gray-100 text-center">
                <svg class="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                <h3 class="mt-2 text-lg font-medium text-gray-900">No Recommendations Found</h3>
                <p class="mt-1 text-sm text-gray-500">We couldn't find any recommendations.</p></div>`;
            paginationEl.innerHTML = '';
            return;
        }

        currentResults = data;
        currentPage = 1;
        displayResultsPage(grid, paginationEl, 1);
    }

    function displayChatResults(data) {
        const grid = document.getElementById('chat-results-grid');
        const container = document.getElementById('chat-results');
        const countEl = document.getElementById('chat-results-count');
        const paginationEl = document.getElementById('chat-pagination');
        
        countEl.textContent = data.length;
        container.classList.remove('hidden');

        if (data.length === 0) {
            grid.innerHTML = `<div class="bg-white p-10 rounded-lg shadow-sm border border-gray-100 text-center">
                <svg class="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <h3 class="mt-2 text-lg font-medium text-gray-900">No Results Found</h3>
                <p class="mt-1 text-sm text-gray-500">AI couldn't find any novels matching your query.</p></div>`;
            paginationEl.innerHTML = '';
            return;
        }

        currentResults = data;
        currentPage = 1;
        displayResultsPage(grid, paginationEl, 1);
    }

    function displayResultsPage(grid, paginationEl, page) {
        currentPage = page;
        grid.innerHTML = '';
        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageResults = currentResults.slice(start, end);
        const cardsHtml = pageResults.map(item => createNovelCard(item)).join('');
        grid.innerHTML = cardsHtml;
        paginationEl.innerHTML = '';
        createPagination(currentResults.length, page, paginationEl, (newPage) => displayResultsPage(grid, paginationEl, newPage));
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
        if (chartInstance) chartInstance.destroy();
        return new Chart(ctx, {
            type: chartType,
            data: data,
            options: { responsive: true, maintainAspectRatio: false, ...options }
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
        topGenresChart = createOrUpdateChart(topGenresChart, 'top-genres-chart', 'bar', chartData, 
            { scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } });
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
        topTagsChart = createOrUpdateChart(topTagsChart, 'top-tags-chart', 'bar', chartData,
            { indexAxis: 'y', scales: { x: { beginAtZero: true } }, plugins: { legend: { display: false } } });
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
        novelsPerYearChart = createOrUpdateChart(novelsPerYearChart, 'novels-per-year-chart', 'line', chartData,
            { scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } });
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
            const data = await fetchApi(`/search/${searchType}/${encodedQuery}`);
            displaySearchResults(data);
            showNotification(`Found ${data.length} result(s)`, 'success');
        } catch (error) {
            displaySearchResults([]);
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = 'Search';
        }
    }

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
            const data = await fetchApi(`/recommend/${recommendType}/${encodedTitle}`);
            displayRecommendations(data);
            showNotification(`Found ${data.length} recommendation(s)`, 'success');
        } catch (error) {
            displayRecommendations([]);
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = 'Get';
        }
    }

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
        const thinkingContainer = document.getElementById('chat-thinking-container');
        thinkingContainer.classList.remove('hidden');
        thinkingContainer.innerHTML = `<div class="bg-gradient-to-r from-teal-50 to-blue-50 p-6 rounded-lg border border-teal-200 animate-pulse">
            <div class="flex items-center gap-3">
                <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600"></div>
                <p class="text-teal-700 font-medium">Thinking for better answer...</p>
            </div></div>`;
        try {
            const data = await fetchApi('/llm-query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: question })
            });
            thinkingContainer.classList.add('hidden');
            if (data.error) {
                showNotification(data.answer || data.error, 'error');
                displayChatResults([]);
            } else {
                lastLlmQuestion = question;
                lastLlmResponse = data.thinking;
                displayChatResults(data.results || []);
                document.getElementById('show-thinking-btn').classList.remove('hidden');
                showNotification(`Found ${(data.results || []).length} result(s)`, 'success');
            }
        } catch (error) {
            thinkingContainer.classList.add('hidden');
            displayChatResults([]);
        } finally {
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
        }
    }

    // === Thinking Process Toggle ===
    
    window.toggleThinkingProcess = function() {
        const container = document.getElementById('chat-flowchart-container');
        const btn = document.getElementById('show-thinking-btn');
        const button = btn.querySelector('button'); // Get the actual button element
        
        if (container.classList.contains('hidden')) {
            // Show thinking process
            container.classList.remove('hidden');
            button.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
                Hide Thinking Process
            `;
            
            // Render flowchart
            if (lastLlmResponse) {
                container.innerHTML = `<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h4 class="text-lg font-semibold text-gray-900 mb-4">🧠 AI Thinking Process</h4>
                    <div class="mb-4"><p class="text-sm font-medium text-gray-600 mb-1">Your Question:</p>
                        <div class="bg-blue-50 p-3 rounded border border-blue-200"><p class="text-gray-800">${escapeHtml(lastLlmResponse.question)}</p></div></div>
                    <div class="flex justify-center mb-4"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-teal-600"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg></div>
                    <div class="mb-4"><p class="text-sm font-medium text-gray-600 mb-1">Generated Cypher Query:</p>
                        <div class="bg-gray-900 p-4 rounded overflow-x-auto"><pre class="text-green-400 text-sm font-mono">${escapeHtml(lastLlmResponse.cypher)}</pre></div></div>
                    <div class="flex justify-center mb-4"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-teal-600"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg></div>
                    <div><p class="text-sm font-medium text-gray-600 mb-1">AI Analysis:</p>
                        <div class="bg-teal-50 p-3 rounded border border-teal-200"><p class="text-gray-800">${escapeHtml(lastLlmResponse.answer)}</p></div></div>
                </div>`;
            }
        } else {
            // Hide thinking process
            container.classList.add('hidden');
            button.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>
                Show Thinking Process
            `;
        }
    }

    // === Initialize ===
    
    function initialize() {
        document.getElementById('tab-dashboard').addEventListener('click', () => switchView('dashboard'));
        document.getElementById('tab-search').addEventListener('click', () => switchView('search'));
        document.getElementById('tab-recommend').addEventListener('click', () => switchView('recommend'));
        document.getElementById('tab-chat').addEventListener('click', () => switchView('chat'));
        document.getElementById('form-search-single').addEventListener('submit', handleSearchFormSubmit);
        document.getElementById('form-recommend-single').addEventListener('submit', handleRecommendFormSubmit);
        document.getElementById('form-llm-query').addEventListener('submit', handleLlmFormSubmit);
        loadDashboardData();
    }

    initialize();
});
