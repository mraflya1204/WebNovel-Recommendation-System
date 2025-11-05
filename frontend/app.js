// Menunggu DOM dimuat sebelum menjalankan skrip
document.addEventListener('DOMContentLoaded', () => {

    // === Konfigurasi & Variabel Global ===
    const API_BASE_URL = 'http://127.0.0.1:5001/api'; // Pastikan port 5001
    
    // Variabel untuk menyimpan instance chart
    let topGenresChart, topTagsChart, novelsPerYearChart;
    
    // Template HTML untuk spinner
    const SPINNER_SVG = `<svg class="spinner" viewBox="0 0 50 50"><circle class="opacity-25" cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="4"></circle><circle class="opacity-75" cx="25" cy="25" r="20" fill="none" stroke="currentColor" stroke-width="4" stroke-dasharray="31.415, 31.415" stroke-dashoffset="31.415"></circle></svg>`;
    const SPINNER_BUTTON_HTML = `<div class="spinner" role="status"></div> Loading...`;
    const SPINNER_LOADING_HTML = `
        <div class="flex flex-col justify-center items-center p-10 text-gray-500">
            ${SPINNER_SVG.replace('w-4 h-4', 'w-8 h-8')}
            <span class="text-gray-500 ml-3 mt-3">Fetching data...</span>
        </div>`;

    // === Referensi Elemen DOM ===
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    
    // Tampilan Utama
    const dashboardView = document.getElementById('dashboard-view');
    const resultsView = document.getElementById('results-view');
    const resultsContainer = document.getElementById('results-container');
    const resultsTitle = document.getElementById('results-title');

    // Tombol Toggle Mode
    const toggleButtons = {
        dashboard: document.getElementById('mode-toggle-dashboard'),
        search: document.getElementById('mode-toggle-search'),
        recommend: document.getElementById('mode-toggle-recommend')
    };
    const modeContainers = {
        search: document.getElementById('search-forms-container'),
        recommend: document.getElementById('recommend-forms-container')
    };
    
    // Kontainer Notifikasi
    const notificationContainer = document.getElementById('notification-container');

    // === Fungsi Helper ===

    /**
     * Menampilkan notifikasi pop-up (pengganti alert)
     * @param {string} message - Pesan yang akan ditampilkan
     * @param {string} type - 'success' (hijau) or 'error' (merah)
     */
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

        // Animasikan
        setTimeout(() => {
            notification.classList.remove('translate-x-10', 'opacity-0');
            notification.classList.add('translate-x-0', 'opacity-100');
        }, 10); // Mulai animasi

        // Hapus setelah 4 detik
        setTimeout(() => {
            notification.classList.add('opacity-0', 'translate-x-10');
            // Hapus dari DOM setelah animasi selesai
            setTimeout(() => notification.remove(), 300);
        }, 4000);
    }

    /**
     * Fungsi generik untuk memanggil API
     * @param {string} endpoint - Path API (e.g., '/search/title/Solo')
     */
    async function fetchApi(endpoint) {
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`);
            if (!response.ok) {
                throw new Error(`Network response was not ok (status: ${response.status})`);
            }
            const data = await response.json();
            return data;

        } catch (error) {
            console.error('Error fetching API:', error);
            showNotification(`Failed to fetch API endpoint: ${endpoint}`, 'error');
            throw error; // Melempar error agar bisa ditangani oleh pemanggil
        }
    }

    /**
     * Menampilkan/menyembunyikan tampilan utama (Dashboard vs Results)
     * @param {string} viewName - 'dashboard' or 'results'
     */
    function showMainView(viewName) {
        dashboardView.classList.toggle('hidden', viewName !== 'dashboard');
        resultsView.classList.toggle('hidden', viewName !== 'results');
    }

    /**
     * Mengatur tombol & form di sidebar
     * @param {string} mode - 'dashboard', 'search', or 'recommend'
     */
    function setSidebarMode(mode) {
        // Atur gaya tombol
        Object.values(toggleButtons).forEach(button => {
            button.classList.remove('bg-teal-600', 'text-white', 'shadow-sm');
            button.classList.add('text-gray-600', 'hover:bg-gray-100', 'hover:text-gray-900');
        });
        if (toggleButtons[mode]) {
            toggleButtons[mode].classList.add('bg-teal-600', 'text-white', 'shadow-sm');
            toggleButtons[mode].classList.remove('text-gray-600', 'hover:bg-gray-100', 'hover:text-gray-900');
        }
        
        // Tampilkan form yang sesuai
        modeContainers.search.classList.toggle('hidden', mode !== 'search');
        modeContainers.recommend.classList.toggle('hidden', mode !== 'recommend');
    }

    /**
     * Merender hasil (novel) sebagai "Novel Cards" (Desain Baru)
     * @param {Array} data - Array data dari API
     * @param {string} title - Judul untuk bagian hasil
     */
    function renderResults(data, title) {
        resultsTitle.textContent = title;
        resultsContainer.innerHTML = ''; // Bersihkan hasil sebelumnya

        if (!data || data.length === 0) {
            resultsContainer.innerHTML = `
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

        const cardsHtml = data.map(item => {
            const novelTitle = item.title || item.recommendation || 'Unknown Title';
            const reason = item.reason 
                ? `<span class="mt-2 sm:mt-0 inline-block bg-teal-100 text-teal-800 text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">${item.reason}</span>` 
                : '';
            const details = item.year ? `<p class="text-sm text-gray-500 mt-1">${item.year} | ${item.language || 'N/A'}</p>` : '';

            return `
                <div class="bg-white p-5 rounded-lg shadow-sm border border-gray-100 hover:shadow-lg hover:border-teal-300 transition-all duration-200 group flex flex-col sm:flex-row justify-between sm:items-start gap-3">
                    <div>
                        <h3 class="text-lg font-semibold text-teal-700 group-hover:text-teal-600 transition-colors">${novelTitle}</h3>
                        ${details}
                    </div>
                    ${reason}
                </div>
            `;
        }).join('');

        resultsContainer.innerHTML = cardsHtml;
        showMainView('results');
    }
    
    /**
     * Helper untuk memotong label chart yang panjang
     */
    function wrapChartLabel(value, context, maxLength = 16) {
        const label = context.chart.data.labels[value];
        if (label.length > maxLength) {
            return label.substring(0, maxLength) + '...';
        }
        return label;
    }
    
    /**
     * Fungsi generik untuk membuat/memperbarui chart
     */
    function createOrUpdateChart(chartInstance, canvasId, chartType, data, options) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        if (chartInstance) {
            chartInstance.destroy(); // Hancurkan chart lama jika ada
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

    // === Fungsi Pemuatan Dashboard ===

    async function loadDashboardData() {
        try {
            // Tampilkan pesan loading
            renderTopGenresChart(null, true);
            renderTopTagsChart(null, true);
            renderNovelsPerYearChart(null, true);

            // Panggil ketiga endpoint statistik secara paralel
            const [genresData, tagsData, yearsData] = await Promise.all([
                fetchApi('/stats/top-genres'),
                fetchApi('/stats/top-tags'),
                fetchApi('/stats/novels-per-year')
            ]);
            
            // Render data ke chart
            renderTopGenresChart(genresData);
            renderTopTagsChart(tagsData);
            renderNovelsPerYearChart(yearsData);

        } catch (error) {
            console.error("Failed to load dashboard:", error);
            // Tampilkan error di container chart
            renderTopGenresChart(null, false, "Failed to load data");
            renderTopTagsChart(null, false, "Failed to load data");
            renderNovelsPerYearChart(null, false, "Failed to load data");
        }
    }

    function getChartElements(canvasId) {
        const canvas = document.getElementById(canvasId);
        const container = canvas.closest('.chart-container');
        const overlay = container.querySelector('.loading-overlay');
        return { canvas, container, overlay };
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
                backgroundColor: 'rgba(20, 184, 166, 0.7)', // Teal 500
                borderColor: 'rgba(15, 118, 110, 1)', // Teal 700
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
                backgroundColor: 'rgba(59, 130, 246, 0.7)', // Blue 500
                borderColor: 'rgba(37, 99, 235, 1)', // Blue 600
                borderWidth: 1,
                borderRadius: 4
            }]
        };
        const options = {
            indexAxis: 'y', // Membuatnya jadi horizontal bar chart
            scales: { 
                x: { beginAtZero: true },
                y: { ticks: { callback: function(value) { return wrapChartLabel(value, this, 15); } } }
            },
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
                fill: true, // Area chart
                backgroundColor: 'rgba(99, 102, 241, 0.1)', // Indigo 10%
                borderColor: 'rgba(99, 102, 241, 1)', // Indigo 500
                tension: 0.3
            }]
        };
        const options = {
            scales: { y: { beginAtZero: true } },
            plugins: { legend: { display: false } }
        };
        
        novelsPerYearChart = createOrUpdateChart(novelsPerYearChart, 'novels-per-year-chart', 'line', chartData, options);
    }

    // === Fungsi Handler untuk Submit Form ===
    
    /**
     * Handler generik untuk form
     * @param {Event} e - Event submit
     * @param {string} inputId - ID elemen input
     * @param {string} apiEndpoint - Template endpoint (e.g., '/search/title/')
     * @param {string} resultTitle - Judul untuk hasil
     */
    async function handleFormSubmit(e, inputId, apiEndpoint, resultTitle) {
        e.preventDefault(); // Mencegah reload halaman
        
        // Dapatkan tombol submit dan input
        const submitButton = e.submitter || e.target.querySelector('button[type="submit"]');
        const inputElement = document.getElementById(inputId);
        const query = inputElement.value.trim();
        
        if (!query) {
            showNotification("Input cannot be empty.", 'error');
            return;
        }

        // Simpan teks tombol asli & tampilkan loading
        const originalButtonText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = SPINNER_BUTTON_HTML;

        // Tampilkan loading di results
        resultsTitle.textContent = "Loading...";
        resultsContainer.innerHTML = SPINNER_LOADING_HTML;
        showMainView('results');

        try {
            const encodedQuery = encodeURIComponent(query);
            const data = await fetchApi(`${apiEndpoint}${encodedQuery}`);
            renderResults(data, `${resultTitle}: "${query}"`);
        } catch (error) {
            renderResults([], `Error fetching results for "${query}"`);
        } finally {
            // Kembalikan tombol ke keadaan semula
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
        }
    }

    // === Inisialisasi & Event Listeners ===
    
    function initialize() {
        // Atur toggle listener
        toggleButtons.dashboard.addEventListener('click', () => {
            setSidebarMode('dashboard');
            showMainView('dashboard');
        });
        toggleButtons.search.addEventListener('click', () => setSidebarMode('search'));
        toggleButtons.recommend.addEventListener('click', () => setSidebarMode('recommend'));

        // Atur listener untuk form
        document.getElementById('form-search-title').addEventListener('submit', (e) => 
            handleFormSubmit(e, 'search-title-input', '/search/title/', 'Search Results for Title'));
        
        document.getElementById('form-search-genre').addEventListener('submit', (e) => 
            handleFormSubmit(e, 'search-genre-input', '/search/genre/', 'Search Results for Genres'));
        
        document.getElementById('form-search-tag').addEventListener('submit', (e) => 
            handleFormSubmit(e, 'search-tag-input', '/search/tag/', 'Search Results for Tags'));

        document.getElementById('form-recommend-genre').addEventListener('submit', (e) => 
            handleFormSubmit(e, 'recommend-genre-input', '/recommend/genre/', 'Recommendations by Genre'));

        document.getElementById('form-recommend-tag').addEventListener('submit', (e) => 
            handleFormSubmit(e, 'recommend-tag-input', '/recommend/tag/', 'Recommendations by Tag'));

        document.getElementById('form-recommend-author').addEventListener('submit', (e) => 
            handleFormSubmit(e, 'recommend-author-input', '/recommend/author/', 'Recommendations by Author'));
        
        document.getElementById('form-recommend-associated').addEventListener('submit', (e) => 
            handleFormSubmit(e, 'recommend-associated-input', '/recommend/associated/', 'Associated Works'));

        // Tampilkan mode & tampilan default
        setSidebarMode('dashboard');
        showMainView('dashboard');
        
        // Muat data dashboard
        loadDashboardData();
    }

    // Jalankan aplikasi
    initialize();
});
