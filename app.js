"use strict";

// Vue!
var app = new Vue({
    el: "#app",

    // vars
    data: {
        nullified: false,
        title: '',
        newRowDialog: false,
        headersBak: [],
        headers: [],
        rows: [],
        rowsBackup: [],
        search: '',
        isLoading: {
            data: false
        },
        errorMessage: '',
        isError: false,
        snackbar: {
            show: false,
            text: '',
            color: 'success',
            timeout: 5000
        },
        // edit these
        pagination: [
            /*{ text: 'All', value: -1 },*/
            { text: '10', value: 10 },
            { text: '25', value: 25 },
            { text: '50', value: 50 }
        ],
        newRowable: true,
        lockedHeaders: [],
        excludedHeaders: [],
        noEditHeaders: [],
        newRow: {}
    },

    watch: {
        // clears out the new row dialog when closed or canceled
        newRowDialog: function() {
            for (var prop in this.newRow) {
                if (this.newRow.hasOwnProperty(prop)) {
                    this.newRow[prop] = null
                }
            }
        }
    },

    // start here
    mounted: function() {
        this.fetchDataset()
    },

    // functions
    methods: {

        isDataType: function(col, type, isBak) {
            if (isBak) { for (var i in this.headersBak) if (this.headersBak[i].text==col) return this.headersBak[i].dataType == type }
            else { for (var i in this.headers) if (this.headers[i].text==col) return this.headers[i].dataType == type }
            return false
        },

        isEditable: function(col, isBak) {
            if (isBak) {
                for (var i in this.headersBak) if (this.headersBak[i].text==col) return !this.headersBak[i].isPrimaryKey
            }
            else {
                var isPk = false
                var isLocked = false
                for (var i in this.headers) {
                    if (this.headers[i].text==col) {
                        isPk = this.headers[i].isPrimaryKey
                    }
                }
                for (var i in this.lockedHeaders) {
                    if (this.lockedHeaders[i]==col) {
                        isLocked = true
                    }
                }
                return !isPk && !isLocked
            }
            return false
        },

        isNullable: function(col) {
            for (var i in this.headers) if (this.headers[i].text==col) return this.headers[i].isNullable
            return false
        },

        // grab rows from table
        fetchDataset: function() {
            if (this.isLoading.data==true) return
            var mask = getUrlParameter('mask')
            if (mask==null || mask==undefined) return
            this.isLoading.data = true
            axios.post('https://ax1vnode1.cityoflewisville.com/v2/?webservice=ITS/Table Editor/Get Table Data', {
                phrase: mask,
                auth_token: localStorage.colAuthToken,
                user: localStorage.colEmail,
                authtoken: localStorage.colAuthToken
            })
            .then(this.handleDataset)
            .catch(this.networkError)
        },

        // save dataset
        handleDataset: function(results) {
            this.newRowDialog = false
            this.lockedHeaders = results.data.tableinfo[0].lockedheaders.split('|||')
            this.excludedHeaders = results.data.tableinfo[0].excludedheaders.split('|||')
            this.headersBak = results.data.columns.map(function(col) {
                return {
                        text: col.NAME,
                        value: col.NAME,
                        isNullable: col.IS_NULLABLE == 'YES',
                        isPrimaryKey: col.IS_PK == true,
                        dataType: col.DATA_TYPE
                    }
            })
            this.headersBak.forEach(function(header) {
                if (!header.isPrimaryKey) Vue.set(this.newRow, header.text, null)
            }.bind(this))
            this.headers = results.data.columns
                .map(function(col) {
                    return {
                        text: col.NAME,
                        value: col.NAME,
                        isNullable: col.IS_NULLABLE == 'YES',
                        isPrimaryKey: col.IS_PK == true,
                        dataType: col.DATA_TYPE
                    }
                })
                .filter(function(col) {
                    var found = false
                    for (var i in this.excludedHeaders) if (col.text == this.excludedHeaders[i]) found = true
                    return found ? false : true
                }.bind(this))

            this.rows = results.data.rows.map(function(row) {
                var temp = {}
                for (var i in this.headers) {
                    temp[this.headers[i].text] = row[this.headers[i].text]
                }
                return temp
            }.bind(this))
            this.rowsBackup = JSON.parse(JSON.stringify(this.rows))
            this.title = results.data.tableinfo[0].title
            this.isLoading.data = false
        },

        setDate: function(row, col) {
            row[col] = moment().format('YYYY-MM-DD')
        },

        setDateTime: function(row, col) {
            console.log('hi')
            row[col] = moment().format('YYYY-MM-DDThh:mm:ss')+'Z'
        },

        openEditDialog: function() {
            this.nullified = false
        },
        closeEditDialog: function() {
            this.nullified = false
        },
        test: function(a) { console.log(a) },
        cancelEditDialog:function(row, col) {
            // restore value
            var l = this.rowsBackup.length
            for (var i=0; i<l; i++) {
                if (this.rowsBackup[i].ID == row.ID) {
                    row[col] = this.rowsBackup[i][col]
                    return
                }
            }
        },
        saveEditDialog: function(row, column) {

            // reset error message just in case
            this.isError = false
            this.errorMessage = 'You should not see this!'

            // set up object to pass to SP
            var audit = {
                masked: getUrlParameter('mask'),
                pkColumn: '',
                pkValue: row,
                oldValue: '',
                newValue: this.nullified ? null : row[column],
                columnName: column,
                user: localStorage.colEmail,
                auth_token: localStorage.colAuthToken,
                authtoken: localStorage.colAuthToken
            }

            // get primary key
            for (var i in this.headers) if (this.headers[i].isPrimaryKey == true) audit.pkColumn = this.headers[i].text

            // get primary key value
            audit.pkValue = row[audit.pkColumn]

            // find old value
            for (var i in this.rowsBackup) {
                var val = this.rowsBackup[i][column]
                if (this.rowsBackup[i].ID == row.ID) audit.oldValue = val==null||val==undefined ? null : this.rowsBackup[i][column].toString()
            }

            // nullify empty strings if necessary
            if (this.isNullable(column) && audit.newValue == '' || audit.newValue == null) audit.newValue = null

            // check if changes were actually made
            if (audit.newValue == audit.oldValue) {
                this.snackbar.color = 'info'
                this.snackbar.text = 'No change detected'
                this.snackbar.timeout = 2000
                this.snackbar.show = true
            }

            // otherwise continue
            else {
                console.log('>> payload: ', audit)
                // submit changes
                axios.post('https://ax1vnode1.cityoflewisville.com/v2/?webservice=ITS/Table Editor/Update Table Row', audit).
                then(function(res) {

                    if (res.data[0][0].hasOwnProperty('ErrorCode')) {
                        console.log('>> error: ', res.data[0][0])
                        this.snackbar.color = 'error'
                        this.snackbar.text = 'Error: ' + res.data[0][0].ErrorCode + '. Check console.'
                        this.snackbar.timeout = 10000
                        this.snackbar.show = true
                    } else {
                        this.rows = res.data[0].map(function(row) {
                            var temp = {}
                            for (var i in this.headers) {
                                temp[this.headers[i].text] = row[this.headers[i].text]
                            }
                            return temp
                        }.bind(this))
                        this.rowsBackup = JSON.parse(JSON.stringify(this.rows))
                        this.snackbar.color = ''
                        this.snackbar.text = 'Row saved!'
                        this.snackbar.timeout = 2000
                        this.snackbar.show = true
                    }
                }.bind(this))
            }
        },

        insertNewRow: function() {
            var values = []
            this.headersBak
                .filter(function(h) { return !h.isPrimaryKey })
                .map(function(h) { return h.text })
                .forEach(function(h) {
                    // nullify empty strings if necessary
                    if (this.isNullable(h.text) && this.newRow[h] == '' || this.newRow[h] == null) values.push('null')
                    else values.push('\'' + this.newRow[h].replace(/'/g, '\'\'' ) + '\'')
                }.bind(this))

            console.log(values)

            axios.post('https://ax1vnode1.cityoflewisville.com/v2/?webservice=ITS/Table Editor/Insert Table Row', {
                masked: getUrlParameter('mask'),
                columns: this.headersBak.filter(function(h) { return !h.isPrimaryKey }).map(function(h) { return '[' + h.text + ']' }).join(', '),
                values: values.join(', '),
                auth_token: localStorage.colAuthToken
            })
            .then(function(res) {
                if (res.data[0][0].hasOwnProperty('ErrorCode')) {
                    console.log('>> error: ', res.data[0][0])
                    this.snackbar.color = 'error'
                    this.snackbar.text = 'Error: ' + res.data[0][0].ErrorCode + '. Check console.'
                    this.snackbar.timeout = 10000
                    this.snackbar.show = true
                } else { this.fetchDataset() }
            }.bind(this))
        }
    }
})

function getUrlParameter(sParam) {
    var sPageURL = decodeURIComponent(window.location.search.substring(1)),
        sURLVariables = sPageURL.split('&'),
        sParameterName, i;
    for (i = 0; i < sURLVariables.length; i++) {
        sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] === sParam) return sParameterName[1] === undefined ? true : sParameterName[1];
    }

};