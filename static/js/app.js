document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('modal');
    const viewModal = document.getElementById('view-modal');
    const addBtn = document.getElementById('add-btn');
    const closeModalBtn = document.getElementById('close-modal');
    const closeViewModalBtn = document.getElementById('close-view-modal');
    const addItemForm = document.getElementById('add-item-form');
    const itemsGrid = document.getElementById('items-grid');
    const fileInput = document.getElementById('image');
    const fileLabel = document.querySelector('.file-custom-label span');

    // Sidebar & Search Elements
    const menuBtn = document.getElementById('menu-btn');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const sidebarMenu = document.getElementById('sidebar-menu');
    const searchInput = document.getElementById('search-input');

    let allItems = []; // Store fetched items for filtering
    let activeGroup = null;

    // Load initial data
    fetchItems();

    // Modal Controls
    addBtn.addEventListener('click', () => {
        modal.classList.add('active');
    });

    closeModalBtn.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    closeViewModalBtn.addEventListener('click', () => {
        viewModal.classList.remove('active');
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });

    viewModal.addEventListener('click', (e) => {
        if (e.target === viewModal) {
            viewModal.classList.remove('active');
        }
    });

    // File input change handler
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            fileLabel.textContent = e.target.files[0].name;
        } else {
            fileLabel.textContent = 'Choose an image...';
        }
    });

    // Sidebar Logic
    if (menuBtn) {
        menuBtn.addEventListener('click', () => {
            if (sidebar) sidebar.classList.add('active');
            if (sidebarOverlay) sidebarOverlay.classList.add('active');
            renderSidebarMenu();
        });
    }

    function closeSidebar() {
        if (sidebar) sidebar.classList.remove('active');
        if (sidebarOverlay) sidebarOverlay.classList.remove('active');
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }

    // Search Logic
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            filterItems();
        });
    }

    function filterItems() {
        const term = searchInput ? searchInput.value.toLowerCase() : '';

        const filtered = allItems.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(term) ||
                (item.group && item.group.toLowerCase().includes(term));

            // Note: Flask app might not have 'group' property on items yet if DB doesn't support it.
            // But we should handle it gracefully.
            const itemGroup = item.group || 'General';
            const matchesGroup = activeGroup ? (itemGroup === activeGroup || (!item.group && activeGroup === 'General')) : true;

            return matchesSearch && matchesGroup;
        });

        renderItems(filtered);
    }

    function renderSidebarMenu() {
        if (!sidebarMenu) return;
        sidebarMenu.innerHTML = '';

        // Generate Unique Groups
        const groups = new Set();
        allItems.forEach(item => {
            if (item.group) groups.add(item.group);
            else groups.add('General');
        });

        // Add "All Items"
        const allBtn = document.createElement('button');
        allBtn.className = `sidebar-item ${activeGroup === null ? 'active' : ''}`;
        allBtn.innerHTML = `<i class="fa-solid fa-layer-group"></i> All Items`;
        allBtn.onclick = () => {
            activeGroup = null;
            filterItems();
            closeSidebar();
        };
        sidebarMenu.appendChild(allBtn);

        // Add Groups
        Array.from(groups).sort().forEach(group => {
            const btn = document.createElement('button');
            btn.className = `sidebar-item ${activeGroup === group ? 'active' : ''}`;
            // Icon logic
            let icon = 'fa-folder';
            if (group === 'General') icon = 'fa-box-archive';

            btn.innerHTML = `<i class="fa-solid ${icon}"></i> ${group}`;
            btn.onclick = () => {
                activeGroup = group;
                filterItems();
                closeSidebar();
            };
            sidebarMenu.appendChild(btn);
        });
    }

    function renderItems(items) {
        itemsGrid.innerHTML = '';
        if (items.length === 0) {
            itemsGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">
                    <i class="fa-solid fa-box-open" style="font-size: 40px; margin-bottom: 20px; opacity: 0.5;"></i>
                    <p>No items found.</p>
                </div>
            `;
            return;
        }
        items.forEach(addItemToDOM);
    }

    // Form Submission
    addItemForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = addItemForm.querySelector('.btn-submit');
        const originalBtnText = submitBtn.textContent;
        submitBtn.textContent = 'Adding...';
        submitBtn.disabled = true;

        try {
            const file = fileInput.files[0];
            let imageData = null;
            let imageName = null;

            if (file) {
                imageName = file.name;
                imageData = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.readAsDataURL(file);
                });
            }

            const payload = {
                name: document.getElementById('name').value,
                price: parseFloat(document.getElementById('price').value),
                description: document.getElementById('description').value,
                group: document.getElementById('group').value.trim(),
                image: imageData,
                image_filename: imageName
            };

            const response = await fetch('/api/items', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const newItem = await response.json();
                allItems.unshift(newItem); // Add to local list
                filterItems(); // Re-render
                modal.classList.remove('active');
                addItemForm.reset();
                fileLabel.textContent = 'Choose an image...';
            } else {
                alert('Failed to add item');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred');
        } finally {
            submitBtn.textContent = originalBtnText;
            submitBtn.disabled = false;
        }
    });

    async function fetchItems() {
        try {
            const response = await fetch('/api/items');
            allItems = await response.json();
            renderItems(allItems);
        } catch (error) {
            console.error('Error fetching items:', error);
            itemsGrid.innerHTML = '<p style="text-align: center; color: #ff6b6b">Failed to load items.</p>';
        }
    }

    function addItemToDOM(item) {
        // Only if we modify DOM directly (bypassing renderItems), but current logic uses renderItems/filterItems.
        // Keeping logic for card creation.

        const card = document.createElement('div');
        card.className = 'item-card';
        card.style.cursor = 'pointer';
        card.innerHTML = `
            <button class="delete-btn" data-id="${item.id}" onclick="deleteItem(this, ${item.id})">
                <i class="fa-solid fa-trash"></i>
            </button>
            <img src="${item.image_filename ? '/uploads/' + item.image_filename : 'https://placehold.co/600x400/1a1d24/FFF?text=No+Image'}" alt="${item.name}" class="card-image">
            <div class="card-content">
                <div class="card-header">
                    <h3 class="card-title">${item.name}</h3>
                    <span class="card-price">$${item.price.toFixed(2)}</span>
                </div>
                <p class="card-desc">${item.description ? (item.description.length > 100 ? item.description.substring(0, 100) + '...' : item.description) : 'No description provided.'}</p>
            </div>
        `;

        // Add View Functionality
        card.addEventListener('click', () => {
            openViewModal(item);
        });

        // Add delete functionality
        card.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click if we add one later
            deleteItem(item.id, card);
        });

        itemsGrid.appendChild(card); // Append instead of prepend because renderItems clears grid and iterates
    }

    function openViewModal(item) {
        document.getElementById('view-name').textContent = item.name;
        document.getElementById('view-price').textContent = '$' + item.price.toFixed(2);
        document.getElementById('view-description').textContent = item.description || 'No description provided.';

        const img = document.getElementById('view-image');
        if (item.image_filename) {
            img.src = '/uploads/' + item.image_filename;
        } else {
            img.src = 'https://placehold.co/600x400/1a1d24/FFF?text=No+Image';
        }

        viewModal.classList.add('active');
    }

    window.deleteItem = async (id, cardElement) => {
        if (!confirm('Are you sure you want to delete this item?')) return;

        try {
            const response = await fetch(`/api/items/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                cardElement.style.transform = 'scale(0.9)';
                cardElement.style.opacity = '0';
                setTimeout(() => {
                    cardElement.remove();
                    allItems = allItems.filter(i => i.id !== id);
                    if (itemsGrid.children.length === 0) {
                        renderItems([]);
                    }
                }, 300);
            }
        } catch (error) {
            alert('Failed to delete item');
        }
    }
});
