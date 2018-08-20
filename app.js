"use strict";

// Vue!
var app = new Vue({
    el: "#app",

    // vars
    data: {
        nullified: false,
        title: '',
        newRowDialog: false,
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
        excludedHeaders: [],
        noEditHeaders: [],
    },

    // start here
    mounted: function() {
        this.fetchDataset()
    },

    // functions
    methods: {

        isDataType: function(col, type) {
            for (var i in this.headers) if (this.headers[i].text==col) return this.headers[i].dataType == type
            return false
        },

        isEditable: function(col) {
            for (var i in this.headers) if (this.headers[i].text==col) return !this.headers[i].isPrimaryKey
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
            axios.post('http://ax1vnode1.cityoflewisville.com/v2/?webservice=ITS/Table Editor/Get Table Data', {
                phrase: mask,
                auth_token: localStorage.colAuthToken
            })
            .then(this.handleDataset)
            .catch(this.networkError)
        },

        // save dataset
        handleDataset: function(results) {
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
                auth_token: localStorage.colAuthToken
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
                axios.post('http://ax1vnode1.cityoflewisville.com/v2/?webservice=ITS/Table Editor/Update Table Row', audit).
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