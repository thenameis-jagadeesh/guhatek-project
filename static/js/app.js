// Global variables
let tableData = [];
let tableColumns = [];
let groupChart = null;
let distributionChart = null;
let dropdownOptions = {};

// Desired field order for candidate management UI
const FIELD_ORDER = [
    'Candidate', 'Name', 'Email ID', 'Contact Number', 'Interested Position', 'Current Role',
    'Current Organization', 'Current Location', 'Current CTC per Annum',
    'Expected CTC per Annum', 'Total Years of Experience', 'Notice Period',
    'Interview Status', 'Application Status', 'Referred By', 'Comments',
    'In Notice', 'Immediate Joiner', 'Offers in Hand', 'Offered CTC',
    'Location Preference', 'Certifications', 'Resume', 'LinkedIn Profile',
    // Stage-specific remarks captured separately in forms/details
    'Initial Screening', 'Round 1 Remarks', 'Round 2 Remarks', 'Final Remarks',
    // General/legacy remarks
    'Remarks', 'Reject Mail Sent', 'Month Count'
];

// Predefined dropdown options
const PREDEFINED_DROPDOWNS = {
    'Interview Status': [
        'Applied',
        'Profile Screening Comp',
        'Voice Screening Comp',
        'Tech Inter Sched',
        'Tech Inter Comp',
        'Code Inter Sched',
        'Code Inter Comp',
        'HR Inter Sched',
        'HR Inter Comp',
        'Offer',
        'Pending Final Noti',
        'References',
        'All Completed'
    ],
    'Application Status': [
        'Proceed Further',
        'On Hold',
        'No Resp Call/Email',
        'Did Not Join',
        'Sent',
        'Recieved',
        'In Notice',
        'Accepted',
        'Rejected',
        'Joined'
    ]
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Load dropdown options first
    fetchDropdownOptions().then(() => {
        // Then load data
        fetchData();
    });
    
    // Set up event listeners
    const saveBtn = document.getElementById('saveDataBtn');
    const updateBtn = document.getElementById('updateDataBtn');
    const groupByColumn = document.getElementById('groupByColumn');
    
    if (saveBtn) saveBtn.addEventListener('click', saveNewRecord);
    if (updateBtn) updateBtn.addEventListener('click', updateRecord);
    if (groupByColumn) groupByColumn.addEventListener('change', function() {
        fetchGroupAnalysis(this.value);
    });
    
    // Set up tab navigation (only for links that target tabs)
    document.querySelectorAll('.nav-link[data-bs-target]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const tabId = this.getAttribute('data-bs-target');
            if (!tabId) {
                return;
            }
            
            // Hide all tab panes
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.remove('show', 'active');
            });
            
            // Show the selected tab pane
            const targetPane = document.querySelector(tabId);
            if (targetPane) {
                targetPane.classList.add('show', 'active');
            }
            
            // Update active state on nav links
            document.querySelectorAll('.nav-link[data-bs-target]').forEach(navLink => {
                navLink.classList.remove('active');
            });
            this.classList.add('active');
            
            // Load analysis data when switching to analysis tab
            if (tabId === '#analysisTab') {
                // Summary removed: skip fetchSummary()
                const groupByColumn = document.getElementById('groupByColumn');
                if (groupByColumn && groupByColumn.value) {
                    fetchGroupAnalysis(groupByColumn.value);
                }
                updateDistributionChart();
            }
        });
    });
});

// Update distribution chart for numeric fields
function updateDistributionChart() {
    const numericColumns = ['Current CTC per Annum', 'Expected CTC per Annum', 'Offered CTC'];
    let selectedColumn = null;
    
    for (const column of numericColumns) {
        if (tableColumns.includes(column)) {
            selectedColumn = column;
            break;
        }
    }
    
    if (!selectedColumn || tableData.length === 0) {
        document.getElementById('distributionChartContainer').innerHTML = 
            '<div class="alert alert-info">No numeric data available for distribution analysis</div>';
        return;
    }
    
    const values = tableData
        .map(item => parseFloat(item[selectedColumn]))
        .filter(value => !isNaN(value));
    
    if (values.length === 0) {
        document.getElementById('distributionChartContainer').innerHTML = 
            '<div class="alert alert-info">No valid numeric data available for distribution analysis</div>';
        return;
    }
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binCount = Math.min(10, values.length);
    const binSize = (max - min) / binCount;
    
    const bins = Array(binCount).fill(0);
    values.forEach(value => {
        const binIndex = Math.min(Math.floor((value - min) / binSize), binCount - 1);
        bins[binIndex]++;
    });
    
    const binLabels = Array(binCount).fill(0).map((_, i) => {
        const start = min + i * binSize;
        const end = min + (i + 1) * binSize;
        return `${start.toFixed(1)}-${end.toFixed(1)}`;
    });
    
    const distCanvas = document.getElementById('distributionChart');
    if (!distCanvas) {
        const container = document.getElementById('distributionChartContainer');
        if (container) {
            container.innerHTML = '<div class="alert alert-warning">Distribution chart is unavailable.</div>';
        }
        return;
    }
    const ctx = distCanvas.getContext('2d');
    
    if (distributionChart) {
        distributionChart.destroy();
    }
    
    distributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: binLabels,
            datasets: [{
                label: `Distribution of ${selectedColumn}`,
                data: bins,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Distribution of ${selectedColumn}`
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Frequency'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: selectedColumn
                    }
                }
            }
        }
    });
}



// Function to show candidate details (vertical layout only)
function showCandidateDetails(candidate) {
    const modalContent = document.getElementById('candidateDetailContent');
    modalContent.innerHTML = '';
    
    // Render grouped stage remarks as cards at the top
    const remarksSection = document.createElement('div');
    remarksSection.className = 'mb-4';
    const remarksHeader = document.createElement('div');
    remarksHeader.className = 'fw-bold mb-2';
    remarksHeader.textContent = 'Remarks';
    remarksSection.appendChild(remarksHeader);

    const row = document.createElement('div');
    row.className = 'row g-3';

    const stages = [
        { key: 'Initial Screening', title: 'Initial Screening', color: 'primary' },
        { key: 'Round 1 Remarks', title: 'Round 1', color: 'success' },
        { key: 'Round 2 Remarks', title: 'Round 2', color: 'warning' }
    ];

    stages.forEach(stage => {
        const col = document.createElement('div');
        col.className = 'col-md-4';

        const card = document.createElement('div');
        card.className = `p-3 rounded border bg-${stage.color} bg-opacity-10`;

        const title = document.createElement('div');
        title.className = `fw-semibold mb-2 text-${stage.color}`;
        title.textContent = stage.title;

        const content = document.createElement('div');
        content.className = 'candidate-detail-value';
        const text = candidate[stage.key] || '';
        content.textContent = text;

        card.appendChild(title);
        card.appendChild(content);
        col.appendChild(card);
        row.appendChild(col);
    });

    remarksSection.appendChild(row);
    modalContent.appendChild(remarksSection);
    
    // Use FIELD_ORDER to display fields in the specified order (skip remarks fields already shown)
    FIELD_ORDER.forEach(field => {
        if (field === 'Initial Screening' || field === 'Round 1 Remarks' || field === 'Round 2 Remarks' || field === 'Remarks') {
            return; // skip
        }
        if (candidate.hasOwnProperty(field) && candidate[field] !== null && candidate[field] !== '') {
            const detailItem = document.createElement('div');
            detailItem.className = 'mb-3';
            
            const label = document.createElement('div');
            label.className = 'text-muted small fw-semibold mb-1';
            label.textContent = field === 'Timestamp' ? 'Date:' : field + ':';
            
            const value = document.createElement('div');
            value.className = 'candidate-detail-value';
            
            // Special handling for specific fields
            if (field === 'Resume' && candidate[field]) {
                value.innerHTML = `<a href="${candidate[field]}" target="_blank" class="btn btn-outline-primary btn-sm">
                    <i class="bi bi-file-earmark-pdf me-1"></i>View Resume
                </a>`;
            } else if (field === 'LinkedIn Profile' && candidate[field]) {
                value.innerHTML = `<a href="${candidate[field]}" target="_blank" class="btn btn-outline-primary btn-sm">
                    <i class="bi bi-linkedin me-1"></i>View LinkedIn
                </a>`;
            } else if (field === 'Interview Status' || field === 'Application Status') {
                const badgeClass = getStatusBadgeClass(candidate[field]);
                value.innerHTML = `<span class="badge ${badgeClass}">${candidate[field]}</span>`;
            } else if (field === 'Timestamp' && candidate[field]) {
                // Format timestamp to show only date
                const date = new Date(candidate[field]);
                value.textContent = date.toLocaleDateString();
            } else {
                value.textContent = field === 'Timestamp' && candidate[field] ? new Date(candidate[field]).toLocaleDateString() : candidate[field];
            }
            
            detailItem.appendChild(label);
            detailItem.appendChild(value);
            modalContent.appendChild(detailItem);
        }
    });
    
    // Display any remaining fields not in FIELD_ORDER
    const remainingFields = Object.keys(candidate).filter(field => !FIELD_ORDER.includes(field));
    remainingFields.forEach(field => {
        if (candidate.hasOwnProperty(field) && candidate[field] !== null && candidate[field] !== '') {
            const detailItem = document.createElement('div');
            detailItem.className = 'mb-3';
            
            const label = document.createElement('div');
            label.className = 'text-muted small fw-semibold mb-1';
            label.textContent = field === 'Timestamp' ? 'Date:' : field + ':';
            
            const value = document.createElement('div');
            value.className = 'candidate-detail-value';
            // Ensure Timestamp shows only date in remaining fields as well
            if (field === 'Timestamp' && candidate[field]) {
                const date = new Date(candidate[field]);
                value.textContent = date.toLocaleDateString();
            } else {
                value.textContent = candidate[field];
            }
            
            detailItem.appendChild(label);
            detailItem.appendChild(value);
            modalContent.appendChild(detailItem);
        }
    });
    
    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('candidateDetailModal'));
    modal.show();
}





// Function to get status badge class
function getStatusBadgeClass(status) {
    switch(status) {
        case 'Active': return 'bg-success';
        case 'Inactive': return 'bg-secondary';
        case 'Pending': return 'bg-warning';
        case 'Rejected': return 'bg-danger';
        case 'Selected': return 'bg-info';
        default: return 'bg-primary';
    }
}

// Function to fetch dropdown options from the server
async function fetchDropdownOptions() {
    try {
        const response = await fetch('/api/dropdown-options');
        if (!response.ok) {
            throw new Error('Failed to fetch dropdown options');
        }
        const serverOptions = await response.json();
        
        // Merge server options with predefined options
        dropdownOptions = { ...serverOptions, ...PREDEFINED_DROPDOWNS };
        console.log('Dropdown options loaded:', dropdownOptions);
    } catch (error) {
        console.error('Error fetching dropdown options:', error);
        // Use predefined options if server fetch fails
        dropdownOptions = { ...PREDEFINED_DROPDOWNS };
    }
}

// Fetch data from the API
function fetchData() {
    fetch('/api/data')
        .then(response => response.json())
        .then(responseData => {
            const { data, is_admin } = responseData;
            populateTable(data, is_admin);
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            showNotification('Failed to load data. Please try again later.', 'error');
        });
}

// Function to populate the data table
function populateTable(data, isAdmin) {
    tableData = data;
    const tableBody = document.getElementById('dataTableBody');
    const tableHead = document.getElementById('dataTableHead');
    
    if (!tableBody || !tableHead) {
        console.error('Table elements not found in the DOM');
        return;
    }
    
    tableBody.innerHTML = '';
    tableHead.innerHTML = '';
    
    let columnsToShow = isAdmin ? FIELD_ORDER : ['Name', 'Initial Screening', 'Round 1 Remarks', 'Round 2 Remarks'];

    if (data && data.length > 0) {
        const availableColumns = Object.keys(data[0]);
        const ordered = columnsToShow.filter(c => availableColumns.includes(c));
        const remaining = availableColumns.filter(c => !ordered.includes(c) && c !== 'Timestamp');
        const timestampFirst = availableColumns.includes('Timestamp') ? ['Timestamp'] : [];
        
        tableColumns = [...timestampFirst, ...ordered, ...remaining];
        
        // Create table header
        const headerRow = document.createElement('tr');
        tableColumns.forEach(column => {
            const th = document.createElement('th');
            th.textContent = column;
            headerRow.appendChild(th);
        });
        
        // Add action column header
        const actionTh = document.createElement('th');
        actionTh.textContent = 'Actions';
        actionTh.style.minWidth = '120px';
        headerRow.appendChild(actionTh);
        
        tableHead.appendChild(headerRow);
        
        // Create table rows
        data.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer'; // Add pointer cursor to indicate clickable
            
            // Add click event to show candidate details
            tr.addEventListener('click', (e) => {
                // Don't trigger if clicking on action buttons or dropdowns
                if (!e.target.closest('button') && !e.target.closest('select')) {
                    showCandidateDetails(row);
                }
            });
            
            tableColumns.forEach(column => {
                const td = document.createElement('td');
                
                if (column === 'Candidate') {
                    // Display candidate name or a default identifier
                    const candidateName = row['Name'] || row['Name'] || 'Unknown Candidate';
                    td.textContent = candidateName;
                } else if (column === 'Resume' || column === 'LinkedIn Profile') {
                    if (row[column] && row[column].toString().startsWith('http')) {
                        const link = document.createElement('a');
                        link.href = row[column];
                        link.textContent = column === 'Resume' ? 'View Resume' : 'View Profile';
                        link.target = '_blank';
                        link.className = 'text-decoration-none';
                        td.appendChild(link);
                    } else {
                        td.textContent = row[column] || '';
                    }
                } else if (column === 'Interview Status' || column === 'Application Status') {
                    td.dataset.column = column;
                    const select = document.createElement('select');
                    select.className = 'form-select';
                    select.addEventListener('change', (e) => {
                        const newStatus = e.target.value;
                        const recordIndex = tableData.findIndex(r => r === row);
                        updateRecordStatus(recordIndex, column, newStatus);
                    });

                    const currentStatus = row[column] || '';

                    if (dropdownOptions[column]) {
                        dropdownOptions[column].forEach(option => {
                            const optionElement = document.createElement('option');
                            optionElement.value = option;
                            optionElement.textContent = option;
                            if (option === currentStatus) {
                                optionElement.selected = true;
                            }
                            select.appendChild(optionElement);
                        });
                    }

                    td.appendChild(select);
                } else if (column === 'Timestamp') {
                    // Format timestamp to show only date
                    const timestamp = row[column];
                    if (timestamp) {
                        const date = new Date(timestamp);
                        td.textContent = date.toLocaleDateString();
                    } else {
                        td.textContent = '';
                    }
                } else if (column === 'Initial Screening') {
                    // Display Initial Screening column as separate column
                    td.textContent = row['Initial Screening'] || row['Initial Remarks'] || '';
                    td.style.maxWidth = '200px';
                    td.style.overflow = 'hidden';
                    td.style.textOverflow = 'ellipsis';
                    td.style.whiteSpace = 'nowrap';
                    td.title = row['Initial Screening'] || row['Initial Remarks'] || ''; // Show full text on hover
                } else if (column === 'Round 1 Remarks') {
                    // Display Round 1 Remarks column as separate column
                    td.textContent = row['Round 1 Remarks'] || '';
                    td.style.maxWidth = '200px';
                    td.style.overflow = 'hidden';
                    td.style.textOverflow = 'ellipsis';
                    td.style.whiteSpace = 'nowrap';
                    td.title = row['Round 1 Remarks'] || ''; // Show full text on hover
                } else if (column === 'Round 2 Remarks') {
                    // Display Round 2 Remarks column as separate column
                    td.textContent = row['Round 2 Remarks'] || '';
                    td.style.maxWidth = '200px';
                    td.style.overflow = 'hidden';
                    td.style.textOverflow = 'ellipsis';
                    td.style.whiteSpace = 'nowrap';
                    td.title = row['Round 2 Remarks'] || ''; // Show full text on hover
                } else if (column === 'Remarks') {
                    // General remarks column - show only general remarks (not the three screening remarks)
                    td.textContent = row['Remarks'] || '';
                    td.style.maxWidth = '200px';
                    td.style.overflow = 'hidden';
                    td.style.textOverflow = 'ellipsis';
                    td.style.whiteSpace = 'nowrap';
                    td.title = row['Remarks'] || ''; // Show full text on hover
                } else {
                    td.textContent = row[column] || '';
                }
                
                tr.appendChild(td);
            });
            
            // Add action buttons
            const actionTd = document.createElement('td');
            actionTd.className = 'text-nowrap';
            
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-sm btn-primary me-1';
            editBtn.innerHTML = '<i class="bi bi-pencil"></i> Edit';
            editBtn.addEventListener('click', () => openEditModal(index, isAdmin));
            actionTd.appendChild(editBtn);
            
            if (isAdmin) {
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn btn-sm btn-danger';
                deleteBtn.innerHTML = '<i class="bi bi-trash"></i> Delete';
                deleteBtn.addEventListener('click', () => deleteRecord(index));
                actionTd.appendChild(deleteBtn);
            }
            
            tr.appendChild(actionTd);
            tableBody.appendChild(tr);
        });
        
        updateGroupByOptions();
    } else {
        console.log('No data available to populate table');
        tableHead.innerHTML = '<tr><th colspan="100%">No data available</th></tr>';
        tableBody.innerHTML = '<tr><td colspan="100%" class="text-center text-muted">No candidates found</td></tr>';
    }
}

// Function to update record status from the table
function updateRecordStatus(index, column, newStatus) {
    const record = tableData[index];
    const updatedRecord = { ...record, [column]: newStatus };

    fetch(`/api/data/${index}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedRecord),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (data.status === 'success') {
            showNotification('Status updated successfully!', 'success');
            tableData[index][column] = newStatus; // Update local data to avoid full refresh
        } else {
            showNotification(data.message || 'Failed to update status.', 'error');
            fetchData(); // Revert change on failure
        }
    })
    .catch(error => {
        console.error('Error updating record:', error);
        showNotification('Error updating record', 'error');
        fetchData(); // Revert change on failure
    });
}

// Update group by options for analysis
function updateGroupByOptions() {
    const groupBySelect = document.getElementById('groupByColumn');
    if (!groupBySelect) {
        return; // Dropdown removed; skip populating options
    }
    groupBySelect.innerHTML = '';
    
    tableColumns.forEach(column => {
        if (column !== 'Timestamp' && 
            column !== 'Email ID' && 
            column !== 'Contact Number' && 
            column !== 'Current CTC per Annum' && 
            column !== 'Expected CTC per Annum' && 
            column !== 'Offered CTC' && 
            column !== 'Resume' && 
            column !== 'LinkedIn Profile' && 
            column !== 'Comments' && 
            column !== 'Remarks' && 
            column !== 'Final Remarks' &&
            column !== 'Initial Screening' && 
            column !== 'Round 1 Remarks' && 
            column !== 'Round 2 Remarks') {
            
            const option = document.createElement('option');
            option.value = column;
            option.textContent = column;
            groupBySelect.appendChild(option);
        }
    });
    
    if (groupBySelect.options.length > 0) {
        fetchGroupAnalysis(groupBySelect.options[0].value);
    }
}

// Function to populate form fields for add/edit modals
function populateFormFields(formId, data = null) {
    const form = document.getElementById(formId);
    
    // For edit form, preserve the hidden input field
    if (formId === 'editDataForm') {
        const hiddenInput = form.querySelector('#editRecordIndex');
        form.innerHTML = '';
        if (hiddenInput) {
            form.appendChild(hiddenInput);
        } else {
            // Create hidden input if it doesn't exist
            const newHiddenInput = document.createElement('input');
            newHiddenInput.type = 'hidden';
            newHiddenInput.id = 'editRecordIndex';
            form.appendChild(newHiddenInput);
        }
    } else {
        // For add form, just clear everything
        form.innerHTML = '';
    }
    // Create form fields based on FIELD_ORDER (standard layout, no grouped cards)
    FIELD_ORDER.forEach(field => {
        if (field !== 'Timestamp' && field !== 'Candidate') {
            const formGroup = document.createElement('div');
            formGroup.className = 'mb-3';

            const label = document.createElement('label');
            label.className = 'form-label';
            label.textContent = field;
            label.htmlFor = field.replace(/\s+/g, '');

            let input;

            if (dropdownOptions[field] && dropdownOptions[field].length > 0) {
                input = document.createElement('select');
                input.className = 'form-select';
                input.id = field.replace(/\s+/g, '');
                input.name = field.replace(/\s+/g, '');

                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = `Select ${field}...`;
                input.appendChild(defaultOption);

                dropdownOptions[field].forEach(option => {
                    const optionElement = document.createElement('option');
                    optionElement.value = option;
                    optionElement.textContent = option;
                    input.appendChild(optionElement);
                });

                if (data && data[field]) {
                    input.value = data[field];
                }
            }
            else if (field === 'Comments' || field === 'Remarks' || field === 'Final Remarks' || field === 'Initial Screening' || field === 'Round 1 Remarks' || field === 'Round 2 Remarks') {
                input = document.createElement('textarea');
                input.className = 'form-control';
                input.id = field.replace(/\s+/g, '');
                input.name = field.replace(/\s+/g, '');
                input.rows = 3;

                if (data && data[field]) {
                    input.value = data[field];
                }
            }
            else if (field === 'Resume' || field === 'LinkedIn Profile') {
                input = document.createElement('input');
                input.type = 'url';
                input.className = 'form-control';
                input.id = field.replace(/\s+/g, '');
                input.name = field.replace(/\s+/g, '');
                input.placeholder = `Enter ${field} URL...`;

                if (data && data[field]) {
                    input.value = data[field];
                }
            }
            else if (field === 'Email ID') {
                input = document.createElement('input');
                input.type = 'email';
                input.className = 'form-control';
                input.id = field.replace(/\s+/g, '');
                input.name = field.replace(/\s+/g, '');
                input.placeholder = `Enter ${field}...`;
                input.required = true;

                if (data && data[field]) {
                    input.value = data[field];
                }
            }
            else if (field === 'Current CTC per Annum' || field === 'Expected CTC per Annum' || field === 'Offered CTC' || field === 'Contact Number') {
                input = document.createElement('input');
                input.type = 'number';
                input.className = 'form-control';
                input.id = field.replace(/\s+/g, '');
                input.name = field.replace(/\s+/g, '');
                input.placeholder = `Enter ${field}...`;

                if (data && data[field]) {
                    input.value = data[field];
                }
            }
            else {
                input = document.createElement('input');
                input.type = 'text';
                input.className = 'form-control';
                input.id = field.replace(/\s+/g, '');
                input.name = field.replace(/\s+/g, '');
                input.placeholder = `Enter ${field}...`;

                if (data && data[field]) {
                    input.value = data[field];
                }
            }

            formGroup.appendChild(label);
            formGroup.appendChild(input);
            form.appendChild(formGroup);
        }
    });
}

// Function to open add modal
function openAddModal() {
    populateFormFields('addDataForm');
    
    const modal = new bootstrap.Modal(document.getElementById('addDataModal'));
    modal.show();
}

// Function to open edit modal
function openEditModal(index, isAdmin) {
    currentEditIndex = index;
    const record = tableData[index];
    const modal = new bootstrap.Modal(document.getElementById('editModal'));
    const formBody = document.getElementById('editFormBody');
    
    formBody.innerHTML = '';
    
    // Determine which fields to show based on admin status
    let fieldsToShow = isAdmin ? FIELD_ORDER : ['Name', 'Initial Screening', 'Round 1 Remarks', 'Round 2 Remarks'];
    
    // Create form fields for each column
    fieldsToShow.forEach(column => {
        if (column === 'Timestamp') return; // Skip timestamp
        
        const formGroup = document.createElement('div');
        formGroup.className = 'mb-3';
        
        const label = document.createElement('label');
        label.className = 'form-label';
        label.textContent = column;
        
        let input;
        
        if (column === 'Interview Status' || column === 'Application Status') {
            input = document.createElement('select');
            input.className = 'form-select';
            
            // Add default option
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Select ' + column;
            input.appendChild(defaultOption);
            
            // Add dropdown options if available
            if (dropdownOptions[column]) {
                dropdownOptions[column].forEach(option => {
                    const optionElement = document.createElement('option');
                    optionElement.value = option;
                    optionElement.textContent = option;
                    if (record[column] === option) {
                        optionElement.selected = true;
                    }
                    input.appendChild(optionElement);
                });
            }
        } else {
            input = document.createElement('textarea');
            input.className = 'form-control';
            input.rows = column.includes('Remarks') || column.includes('Remarks') ? 3 : 1;
            input.value = record[column] || '';
        }
        
        input.id = 'edit_' + column;
        input.name = column;
        
        formGroup.appendChild(label);
        formGroup.appendChild(input);
        formBody.appendChild(formGroup);
    });
    
    modal.show();
}

// Function to save new record
function saveNewRecord() {
    const formData = new FormData(document.getElementById('addDataForm'));
    const newRecord = {};
    
    // Convert form data to object
    for (let [key, value] of formData.entries()) {
        // Convert keys back to original format with spaces
        const originalKey = FIELD_ORDER.find(field => field.replace(/\s+/g, '') === key) || key;
        newRecord[originalKey] = value;
    }
    
    fetch('/api/data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(newRecord),
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showNotification('Record added successfully!', 'success');
            fetchData(); // Refresh table
            bootstrap.Modal.getInstance(document.getElementById('addDataModal')).hide();
        } else {
            showNotification(data.message || 'Failed to add record.', 'error');
        }
    })
    .catch(error => {
        console.error('Error adding record:', error);
        showNotification('Error adding record', 'error');
    });
}

// Function to update record
function updateRecord() {
    const index = document.getElementById('editRecordIndex').value;
    const formData = new FormData(document.getElementById('editDataForm'));
    const updatedRecord = {};
    
    // Convert form data to object
    for (let [key, value] of formData.entries()) {
        // Convert keys back to original format with spaces
        const originalKey = FIELD_ORDER.find(field => field.replace(/\s+/g, '') === key) || key;
        updatedRecord[originalKey] = value;
    }
    
    fetch(`/api/data/${index}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedRecord),
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            showNotification('Record updated successfully!', 'success');
            fetchData(); // Refresh table
            bootstrap.Modal.getInstance(document.getElementById('editDataModal')).hide();
        } else {
            showNotification(data.message || 'Failed to update record.', 'error');
        }
    })
    .catch(error => {
        console.error('Error updating record:', error);
        showNotification('Error updating record', 'error');
    });
}

// Function to delete record
function deleteRecord(index) {
    if (confirm('Are you sure you want to delete this record?')) {
        fetch(`/api/data/${index}`, {
            method: 'DELETE',
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                showNotification('Record deleted successfully!', 'success');
                fetchData(); // Refresh table
            } else {
                showNotification(data.message || 'Failed to delete record.', 'error');
            }
        })
        .catch(error => {
            console.error('Error deleting record:', error);
            showNotification('Error deleting record', 'error');
        });
    }
}

// Function to show notifications
function showNotification(message, type) {
    const notificationContainer = document.getElementById('notificationContainer');
    if (!notificationContainer) return;
    
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'success' ? 'success' : 'danger'} alert-dismissible fade show`;
    notification.role = 'alert';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    notificationContainer.appendChild(notification);
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}

// Function to fetch summary data
function fetchSummary() {
    fetch('/api/analysis/summary')
        .then(response => response.json())
        .then(data => {
            displaySummary(data);
        })
        .catch(error => {
            console.error('Error fetching summary:', error);
        });
}

// Display summary data
function displaySummary(data) {
    const summaryContainer = document.getElementById('summaryContainer');
    // Guard: if the container is missing, avoid runtime errors
    if (!summaryContainer) {
        console.warn('Summary container not found in DOM. Skipping summary render.');
        return;
    }
    summaryContainer.innerHTML = '';
    
    for (const [column, stats] of Object.entries(data)) {
        const card = document.createElement('div');
        card.className = 'card mb-3 shadow-sm';
        
        const cardHeader = document.createElement('div');
        cardHeader.className = 'card-header bg-primary text-white';
        cardHeader.textContent = column;
        
        const cardBody = document.createElement('div');
        cardBody.className = 'card-body';
        
        const statsList = document.createElement('ul');
        statsList.className = 'list-group list-group-flush';
        
        for (const [stat, value] of Object.entries(stats)) {
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
            
            const statName = document.createElement('span');
            statName.textContent = stat.charAt(0).toUpperCase() + stat.slice(1);
            
            const statValue = document.createElement('span');
            statValue.className = 'badge bg-primary rounded-pill';
            statValue.textContent = typeof value === 'number' ? value.toFixed(2) : value;
            
            listItem.appendChild(statName);
            listItem.appendChild(statValue);
            statsList.appendChild(listItem);
        }
        
        cardBody.appendChild(statsList);
        card.appendChild(cardHeader);
        card.appendChild(cardBody);
        summaryContainer.appendChild(card);
    }
}

// Fetch group analysis data
function fetchGroupAnalysis(column) {
    fetch(`/api/analysis/group/${column}`)
        .then(response => response.json())
        .then(data => {
            updateGroupChart(data, column);
        })
        .catch(error => {
            console.error('Error fetching group analysis:', error);
        });
}

// Update group chart
function updateGroupChart(data, groupColumn) {
    const groupCanvas = document.getElementById('groupChart');
    if (!groupCanvas) {
        return;
    }
    const ctx = groupCanvas.getContext('2d');
    
    const labels = data.map(item => item[groupColumn] || 'Unknown');
    const counts = data.map(item => item.count || 0);
    
    if (groupChart) {
        groupChart.destroy();
    }
    
    groupChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Count',
                data: counts,
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Candidates by ${groupColumn}`
                },
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Count'
                    }
                }
            }
        }
    });
}

// Analytics Functions
function updateMonthlyStats(data) {
    const monthlyStats = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Initialize monthly stats
    data.forEach(candidate => {
        const date = new Date(candidate.Timestamp);
        const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        
        if (!monthlyStats[monthKey]) {
            monthlyStats[monthKey] = {
                applicants: 0,
                accepted: 0,
                rejected: 0,
                inNotice: 0,
                joined: 0,
                feedbackGiven: 0
            };
        }
        
        monthlyStats[monthKey].applicants++;
        
        switch (candidate['Application Status']) {
            case 'Accepted':
                monthlyStats[monthKey].accepted++;
                break;
            case 'Rejected':
                monthlyStats[monthKey].rejected++;
                break;
            case 'In Notice':
                monthlyStats[monthKey].inNotice++;
                break;
            case 'Joined':
                monthlyStats[monthKey].joined++;
                break;
        }
        
        if (candidate['Reference Feedback']) {
            monthlyStats[monthKey].feedbackGiven++;
        }
    });
    
    // Sort months chronologically
    const sortedMonths = Object.keys(monthlyStats).sort((a, b) => {
        const [monthA, yearA] = a.split(' ');
        const [monthB, yearB] = b.split(' ');
        return new Date(`${monthA} 1, ${yearA}`) - new Date(`${monthB} 1, ${yearB}`);
    });
    
    // Update table
    const tbody = document.getElementById('monthlyStatsBody');
    const tfoot = document.getElementById('monthlyStatsTotals');
    tbody.innerHTML = '';
    
    const totals = {
        applicants: 0,
        accepted: 0,
        rejected: 0,
        inNotice: 0,
        joined: 0,
        feedbackGiven: 0
    };
    
    sortedMonths.forEach(month => {
        const stats = monthlyStats[month];
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${month}</td>
            <td>${stats.applicants}</td>
            <td>${stats.accepted}</td>
            <td>${stats.rejected}</td>
            <td>${stats.inNotice}</td>
            <td>${stats.joined}</td>
            <td>${stats.feedbackGiven}</td>
        `;
        tbody.appendChild(row);
        
        // Update totals
        Object.keys(totals).forEach(key => {
            totals[key] += stats[key];
        });
    });
    
    // Add totals row
    tfoot.innerHTML = `
        <tr class="table-secondary fw-bold">
            <td>Total</td>
            <td>${totals.applicants}</td>
            <td>${totals.accepted}</td>
            <td>${totals.rejected}</td>
            <td>${totals.inNotice}</td>
            <td>${totals.joined}</td>
            <td>${totals.feedbackGiven}</td>
        </tr>
    `;
    
    // Update key metrics
    updateKeyMetrics(totals);
}

function updateKeyMetrics(totals) {
    const metricsContainer = document.getElementById('keyMetricsContainer');
    const metrics = [
        { label: 'Total Applicants', value: totals.applicants },
        { label: 'Total Accepted', value: totals.accepted },
        { label: 'Total Rejected', value: totals.rejected },
        { label: 'Currently In Notice', value: totals.inNotice },
        { label: 'Total Joined', value: totals.joined }
    ];
    
    metricsContainer.innerHTML = metrics.map(metric => `
        <div class="mb-3">
            <div class="d-flex justify-content-between align-items-center">
                <span class="text-muted">${metric.label}</span>
                <span class="h5 mb-0">${metric.value}</span>
            </div>
            <div class="progress mt-2" style="height: 4px;">
                <div class="progress-bar" style="width: ${(metric.value / totals.applicants * 100) || 0}%"></div>
            </div>
        </div>
    `).join('');
}

function updateApplicationStatusChart(data) {
    const statusCounts = {
        'Total Applicants': data.length,
        'Accepted': 0,
        'Rejected': 0,
        'In Notice': 0,
        'Joined': 0
    };
    
    data.forEach(candidate => {
        if (statusCounts.hasOwnProperty(candidate['Application Status'])) {
            statusCounts[candidate['Application Status']]++;
        }
    });
    
    const ctx = document.getElementById('applicationStatusChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: [
                    '#4f46e5',
                    '#10b981',
                    '#ef4444',
                    '#f59e0b',
                    '#3b82f6'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function updateReferenceFeedbackChart(data) {
    const feedbackCounts = {
        'All 3 Given': 0,
        '2 Given': 0,
        '1 Given': 0,
        '0 Given': 0
    };
    
    data.forEach(candidate => {
        const feedback = candidate['Reference Feedback'] || '';
        const count = feedback.split(',').filter(f => f.trim()).length;
        switch (count) {
            case 3:
                feedbackCounts['All 3 Given']++;
                break;
            case 2:
                feedbackCounts['2 Given']++;
                break;
            case 1:
                feedbackCounts['1 Given']++;
                break;
            default:
                feedbackCounts['0 Given']++;
        }
    });
    
    const ctx = document.getElementById('referenceFeedbackChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(feedbackCounts),
            datasets: [{
                data: Object.values(feedbackCounts),
                backgroundColor: [
                    '#10b981',
                    '#3b82f6',
                    '#f59e0b',
                    '#ef4444'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function updateOverallDistributionChart(data) {
    const months = {};
    data.forEach(candidate => {
        const date = new Date(candidate.Timestamp);
        const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        if (!months[monthKey]) {
            months[monthKey] = 0;
        }
        months[monthKey]++;
    });
    
    const ctx = document.getElementById('overallDistributionChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(months),
            datasets: [{
                data: Object.values(months),
                backgroundColor: [
                    '#4f46e5',
                    '#10b981',
                    '#ef4444',
                    '#f59e0b',
                    '#3b82f6',
                    '#8b5cf6',
                    '#ec4899',
                    '#14b8a6',
                    '#f43f5e',
                    '#84cc16',
                    '#06b6d4',
                    '#6366f1'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                }
            }
        }
    });
}

// Update the existing refreshData function to include analytics updates
async function refreshData() {
    try {
        const response = await fetch('/api/data');
        const data = await response.json();
        
        // Update table
        updateTable(data);
        
        // Update analytics if on analytics tab
        if (document.getElementById('analysisTab').classList.contains('active')) {
            updateMonthlyStats(data);
            updateApplicationStatusChart(data);
            updateReferenceFeedbackChart(data);
            updateOverallDistributionChart(data);
        }
    } catch (error) {
        console.error('Error refreshing data:', error);
        showToast('Error refreshing data', 'danger');
    }
}

// Update the existing showCandidateDetails function to format dates consistently
function showCandidateDetails(candidate) {
    const modal = document.getElementById('candidateDetailModal');
    const content = document.getElementById('candidateDetailContent');
    
    // Format the content with consistent date formatting
    let detailsHTML = '';
    
    // Add primary fields first
    FIELD_ORDER.forEach(field => {
        if (candidate[field] !== undefined) {
            let value = candidate[field];
            if (field === 'Timestamp') {
                value = new Date(value).toLocaleDateString();
            }
            detailsHTML += `
                <div class="candidate-detail-item">
                    <span class="candidate-detail-label">${field === 'Timestamp' ? 'Date' : field}:</span>
                    <span class="candidate-detail-value">${formatFieldValue(field, value)}</span>
                </div>
            `;
        }
    });
    
    // Add remaining fields
    Object.entries(candidate).forEach(([field, value]) => {
        if (!FIELD_ORDER.includes(field)) {
            if (field === 'Timestamp') {
                value = new Date(value).toLocaleDateString();
            }
            detailsHTML += `
                <div class="candidate-detail-item">
                    <span class="candidate-detail-label">${field === 'Timestamp' ? 'Date' : field}:</span>
                    <span class="candidate-detail-value">${formatFieldValue(field, value)}</span>
                </div>
            `;
        }
    });
    
    content.innerHTML = detailsHTML;
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

// Helper to consistently format field values in candidate details
function formatFieldValue(field, value) {
    if (value === null || value === undefined) return '—';
    if (Array.isArray(value)) {
        const joined = value.filter(Boolean).join(', ');
        return joined || '—';
    }
    if (typeof value === 'number') {
        if (!isFinite(value)) return '—';
        const currencyFields = ['Current CTC per Annum', 'Expected CTC per Annum', 'Offered CTC'];
        if (currencyFields.includes(field)) {
            return Number(value).toLocaleString('en-IN');
        }
        return String(value);
    }
    if (typeof value === 'string') {
        const v = value.trim();
        if (!v || ['nil', 'null', 'nan'].includes(v.toLowerCase())) return '—';
        return v;
    }
    try {
        return String(value);
    } catch (e) {
        return '—';
    }
}
