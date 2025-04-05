document.addEventListener('DOMContentLoaded', () => {
    const appContent = document.getElementById('app-content');
    const bottomSheet = document.getElementById('bottom-sheet');
    const sheetContent = document.getElementById('sheet-content');
    const sheetBackdrop = document.getElementById('sheet-backdrop');
    const closeSheetBtn = bottomSheet.querySelector('.close-sheet-btn');

    let coffeeData = null; // To store parsed YAML data
    let currentDrinkData = null; // Store data for the sheet

    // --- Data Loading ---
    async function loadData() {
        try {
            const response = await fetch('config.json'); // Fetch JSON instead of YAML
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const jsonText = await response.text(); // Get text content
            // Use built-in JSON parsing
            coffeeData = JSON.parse(jsonText);
            console.log("Coffee data loaded:", coffeeData);
            // Initial render based on hash or default
            handleHashChange();
            // No need to check for js-yaml library anymore
        } catch (error) {
            // Update error message
            console.error("Error loading or parsing config.json:", error);
            appContent.innerHTML = `<p class="error">Error loading configuration. Please try again later.</p>`;
        }
    }

    // --- Routing ---
    function handleHashChange() {
        const hash = window.location.hash;
        hideBottomSheet(); // Close sheet on navigation

        if (!coffeeData) {
            appContent.innerHTML = `<div class="loading">Loading Recipes...</div>`;
            return; // Data not loaded yet
        }

        if (hash.startsWith('#category/')) {
            const categoryId = hash.substring('#category/'.length);
            renderDrinks(categoryId);
        } else if (hash.startsWith('#drink/')) {
            const drinkId = hash.substring('#drink/'.length);
            // Find the drink and show details (will be rendered by click handler usually)
            // For direct linking, find and show:
            const drink = findDrinkById(drinkId);
            const category = findCategoryByDrinkId(drinkId);
            if (drink && category) {
                 // Render the category grid first so back navigation works
                renderDrinks(category.id);
                // Then show the bottom sheet for the specific drink
                renderDrinkDetails(drink);
                showBottomSheet();
            } else {
                renderCategories(); // Fallback to categories if drink not found
            }
        } else {
            renderCategories(); // Default view
        }
    }

    // --- Rendering Functions ---
    function renderCategories() {
        if (!coffeeData || !coffeeData.categories) {
            appContent.innerHTML = `<p class="error">No categories found in configuration.</p>`;
            return;
        }
        const categoriesHtml = coffeeData.categories.map(category => `
            <li class="tile category-tile" data-category-id="${category.id}">
                ${category.name}
            </li>
        `).join('');
        appContent.innerHTML = `<ul class="tile-grid">${categoriesHtml}</ul>`;
        addTileEventListeners('.category-tile', 'categoryId', (id) => {
            window.location.hash = `#category/${id}`;
        });
    }

    function renderDrinks(categoryId) {
        const category = coffeeData.categories.find(cat => cat.id === categoryId);
        if (!category || !category.drinks) {
            appContent.innerHTML = `<p class="error">Category not found or has no drinks.</p><p><a href="#">Back to Categories</a></p>`;
            return;
        }

        // --- Create Category Pills Navigation ---
        const allCategories = coffeeData.categories || [];
        const pillsHtml = allCategories.map(cat => `
            <a href="#category/${cat.id}" 
               class="category-pill ${cat.id === categoryId ? 'active' : ''}" 
               data-category-id="${cat.id}">
                ${cat.name}
            </a>
        `).join('');
        const categoryPillsNav = `<nav class="category-pills-container">${pillsHtml}</nav>`;
        // --- End Category Pills Navigation ---

        const drinksHtml = category.drinks.map(drink => `
            <li class="tile drink-tile" data-drink-id="${drink.id}" data-category-id="${categoryId}">
                ${drink.name}
            </li>
        `).join('');

        // Add pills nav before the rest of the content
        appContent.innerHTML = `
            ${categoryPillsNav} 
            <h2>${category.name}</h2>
            <ul class="tile-grid">${drinksHtml}</ul>`;

        addTileEventListeners('.drink-tile', 'drinkId', (id) => {
            const clickedDrink = findDrinkById(id);
            if (clickedDrink) {
                renderDrinkDetails(clickedDrink);
                // Set hash *after* rendering details to prevent double render via hashchange
                window.location.hash = `#drink/${id}`;
                showBottomSheet();
            }
        });

        // Add listener for the back link
        const backLink = appContent.querySelector('.back-link');
        if(backLink) {
            backLink.onclick = (e) => {
                e.preventDefault();
                window.location.hash = '#'; // Go back to categories view
            }
        }
    }

    function renderDrinkDetails(drink) {
        currentDrinkData = drink; // Store for potential future use
        let detailsHtml = `<h2>${drink.name}</h2>`;

        // Video Embedding
        if (drink.video) {
            const videoEmbedHtml = getVideoEmbedHtml(drink.video);
            if (videoEmbedHtml) {
                detailsHtml += `<div class="video-container">${videoEmbedHtml}</div>`;
            }
        }

        // Start Definition List for attributes
        detailsHtml += `<div class="drink-detail"><dl>`;

        // Standard Attribute: Cup
        if (drink.cup) {
            detailsHtml += `<dt>Cup Type:</dt><dd>${drink.cup}</dd>`;
        }

        // Dynamic Attributes
        const knownKeys = ['id', 'name', 'video', 'cup']; // Keys to exclude from dynamic list
        for (const key in drink) {
            if (!knownKeys.includes(key) && Object.hasOwnProperty.call(drink, key)) {
                const label = formatLabel(key); // Convert snake_case to Title Case
                detailsHtml += `<dt>${label}:</dt><dd>${drink[key]}</dd>`;
            }
        }

        detailsHtml += `</dl></div>`; // End Definition List and container
        sheetContent.innerHTML = detailsHtml;
    }

    // --- Bottom Sheet Logic ---
    function showBottomSheet() {
        bottomSheet.classList.add('visible');
        sheetBackdrop.classList.add('visible');
        // Optional: Trap focus within the sheet for accessibility
    }

    function hideBottomSheet() {
        bottomSheet.classList.remove('visible');
        sheetBackdrop.classList.remove('visible');
        // If navigating away, clear the hash part related to the drink
        if (window.location.hash.startsWith('#drink/')) {
             // Find category ID to navigate back to drink list, not home
            const drinkId = window.location.hash.substring('#drink/'.length);
            const category = findCategoryByDrinkId(drinkId);
            if (category) {
                // Go back to the category view without triggering a full reload if possible
                // Using replaceState avoids adding a history entry for closing the sheet
                 history.replaceState(null, '', `#category/${category.id}`);
            } else {
                 history.replaceState(null, '', '#'); // Fallback to home
            }
        }
        currentDrinkData = null;
    }

    // --- Event Listeners ---
    function addTileEventListeners(selector, dataAttribute, callback) {
        document.querySelectorAll(selector).forEach(tile => {
            tile.addEventListener('click', () => {
                const id = tile.dataset[dataAttribute];
                callback(id);
            });
        });
    }

    window.addEventListener('hashchange', handleHashChange);
    closeSheetBtn.addEventListener('click', hideBottomSheet);
    sheetBackdrop.addEventListener('click', hideBottomSheet);

    // --- Helper Functions ---
    function findDrinkById(drinkId) {
        if (!coffeeData || !coffeeData.categories) return null;
        for (const category of coffeeData.categories) {
            const drink = category.drinks.find(d => d.id === drinkId);
            if (drink) return drink;
        }
        return null;
    }

     function findCategoryByDrinkId(drinkId) {
        if (!coffeeData || !coffeeData.categories) return null;
        for (const category of coffeeData.categories) {
            const drink = category.drinks.find(d => d.id === drinkId);
            if (drink) return category;
        }
        return null;
    }

    function formatLabel(key) {
        // Converts 'some_key_name' to 'Some Key Name'
        return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }

    function getVideoEmbedHtml(url) {
        let videoId;
        let embedUrl = null;

        try {
            const urlObj = new URL(url);
            if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
                if (urlObj.hostname.includes('youtu.be')) {
                    videoId = urlObj.pathname.substring(1);
                } else {
                    videoId = urlObj.searchParams.get('v');
                }
                if(videoId) embedUrl = `https://www.youtube.com/embed/${videoId}`;
            } else if (urlObj.hostname.includes('vimeo.com')) {
                videoId = urlObj.pathname.split('/').pop();
                 if(videoId && /^\d+$/.test(videoId)) { // Ensure it looks like a Vimeo ID
                     embedUrl = `https://player.vimeo.com/video/${videoId}`;
                 }
            }

            if (embedUrl) {
                return `<iframe src="${embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
            }
        } catch (e) {
            console.error("Error parsing video URL:", url, e);
            return null; // Invalid URL format
        }
        return null; // URL didn't match YouTube/Vimeo patterns
    }

    // --- Initial Load ---
    loadData();

}); // End DOMContentLoaded