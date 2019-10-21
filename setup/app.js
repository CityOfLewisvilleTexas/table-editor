"use strict";

// Vue!
var app = new Vue({
    el: "#app",
    // vuetify: new Vuetify(),
    // vars
    data: {
        dark: false,
        currentTab: 0,
        tabs: [
            { name: 'Create', key: 'create' },
            { name: 'List', key: 'list'}
        ],
        editing: {
            show: false,
            selectedDb: null,
            selectedTb: null,
            masked: null,
            title: null,
            excludedHeaders: null,
            id: null
        },
        masked: '',
        title: '',
        selectedDb: '',
        selectedTb: '',
        phrases: [],
        databases: [],
        tables: [],
        excludedHeaders: [],
        allowedUsers: [],
        lockedHeaders: [],
        isLoading: {
            phrases: false,
            db: false,
            tb: false
        },
        generated: false
    },

    watch: {
        selectedDb: function() {
            this.tables = []
            this.selectedTb = ''
            this.fetchTables()
        }
    },

    computed: {
        fullTableName: function() {
            if (this.selectedDb==''||this.selectedTb=='') return ''
            var fullname = ''
            for (var i in this.tables) {
                if (this.tables[i].value == this.selectedTb) fullname = this.selectedDb + '.' + this.tables[i].schema + '.' + this.selectedTb
            }
            return fullname
        }
    },

    // start here
    mounted: function() {
        this.fetchPhrases()
        this.fetchDatabases()
    },

    // functions
    methods: {

        // fetch databases on vsql8
        fetchPhrases: function() {
            this.isLoading.phrases = true
            axios.post('http://ax1vnode1.cityoflewisville.com/v2/?webservice=ITS/Table Editor/Get Masked Table Names', {
                auth_token: localStorage.colAuthToken
            })
            .then(this.handlePhrases)
        },

        // save databases
        handlePhrases: function(results) {
            this.isLoading.phrases = false
            this.phrases = results.data[0]
        },

        // fetch databases on vsql8
        fetchDatabases: function() {
            this.isLoading.db = true
            axios.post('http://ax1vnode1.cityoflewisville.com/v2/?webservice=ITS/Get Databases', {
                auth_token: localStorage.colAuthToken
            })
            .then(this.handleDatabases)
        },

        // save databases
        handleDatabases: function(results) {
            this.isLoading.db = false
            this.databases = results.data[0].map(function(db) {
                return {
                    text: db.NAME,
                    value: db.NAME
                }
            })
        },

        // fetch tables within selectedDb
        fetchTables: function() {
            if (this.selectedDb == '') return
            this.isLoading.tb = true
            axios.post('http://ax1vnode1.cityoflewisville.com/v2/?webservice=ITS/Get Tables From Database', {
                DBNAME: this.selectedDb,
                auth_token: localStorage.colAuthToken
            })
            .then(this.handleTables)
        },

        // save tables
        handleTables: function(results) {
            this.isLoading.tb = false
            this.tables = results.data[0].map(function(tb) {
                return {
                    text: tb.NAME,
                    value: tb.NAME,
                    schema: tb.SCHEMA
                }
            })
            .sort(function(a,b) {
                if (a.text < b.text) return -1
                if (a.text > b.text) return 1
                return 0
            })
        },

        goToTableEditor: function(end) {
            window.open('../?mask=' + end.replace(/ /g, '_'))
        },

        validatePhrase: function(phrase) {
            if (phrase.length==0) return 'Enter a phrase'
            for (var i in this.phrases) {
                if (this.phrases[i].masked.toLowerCase() == phrase.replace(/ /g,'_').toLowerCase()) return 'Enter a unique phrase'
            }
            return ''
        },

        submitPhrase: function() {
            if (this.isLoading.phrases) return
            this.isLoading.phrases = true
            axios.post('http://ax1vnode1.cityoflewisville.com/v2/?webservice=ITS/Table Editor/Insert Masked Table Name', {
                id: -1,
                tablename: this.fullTableName,
                masked: this.masked.replace(/ /g, '_'),
                title: this.title,
                excludedheaders: this.excludedHeaders.join('|||'),
                lockedheaders: this.lockedHeaders.join('|||'),
                allowedusers: this.allowedUsers.join('|||'),
                auth_token: localStorage.colAuthToken
            }).then(this.handlePhraseSubmit)
        },

        handlePhraseSubmit: function(res) {
            this.phrases = res.data[0]
            this.generated = true
            this.isLoading.phrases = false
        },

        submitPhraseEdit: function() {
            if (this.isLoading.phrases) return
            this.isLoading.phrases = true
            axios.post('http://ax1vnode1.cityoflewisville.com/v2/?webservice=ITS/Table Editor/Insert Masked Table Name', {
                id: this.editing.id,
                masked: this.editing.masked.replace(/ /g, '_'),
                title: this.editing.title,
                excludedheaders: this.editing.excludedHeaders.join('|||'),
                lockedheaders: this.editing.lockedHeaders.join('|||'),
                allowedusers: this.editing.allowedUsers.join('|||'),
                auth_token: localStorage.colAuthToken
            }).then(this.handlePhraseEditSubmit)
        },

        handlePhraseEditSubmit: function(res) {
            this.phrases = res.data[0]
            this.isLoading.phrases = false
            this.editing.show = false
        },

        reset: function() {
            this.masked = '',
            this.selectedDb = '',
            this.selectedTb = '',
            this.phrases = [],
            this.databases = [],
            this.tables = [],
            this.title = '',
            this.isLoading.phrases = false,
            this.isLoading.db = false,
            this.isLoading.tb = false
            this.generated = false
            this.excludedHeaders = []
            this.lockedHeaders = []
            this.allowedUsers = []
            this.fetchPhrases()
            this.fetchDatabases()
        },

        fillPhrase: function(animal, editing) {
            var p = ''
            while(this.validatePhrase(p)!='') p = animal ? this.generatePhraseAnimal() : this.generatePhrase()
            if (editing==false) this.masked = p
            else this.editing.masked = p
        },

        generatePhrase: function() {
            var text = "";
            var possible = "abcdefghijklmnopqrstuvwxyz";

            for (var i = 0; i < 6; i++)
            text += possible.charAt(Math.floor(Math.random() * possible.length));

            return text;
        },

        generatePhraseAnimal: function() {
            return generateCombination(2,'')
        },

        deletePhrase: function(phrase) {
            if (confirm('Are you sure?')) {
                if (this.isLoading.phrases) return
                this.isLoading.phrases = true
                axios.post('http://ax1vnode1.cityoflewisville.com/v2/?webservice=ITS/Table Editor/Delete Masked Table Name', {
                    id: phrase.id,
                    auth_token: localStorage.colAuthToken
                }).then(this.handlePhraseDelete)
            }
        },

        handlePhraseDelete: function(res) {
            console.log(res)
            this.phrases = res.data[0]
            this.isLoading.phrases = false
            if (this.validatePhrase(this.masked)=='') this.reset()
        },

        htmlize: function(item) {
            var html = '<span class="text--primary">' + item.masked + '</span> &rarr; ' + item.tablename
            return html
        },

        edit: function(item) {
            try {
            this.editing.show = true
            console.log('after:',this.editing.show)
            var db = item.tablename.split('.')[0]
            var tb = item.tablename.split('.')[2]
            this.editing.selectedDb = db
            Vue.nextTick(function() { this.editing.selectedTb = tb }.bind(this))
            this.editing.masked = item.masked
            this.editing.title = item.title
            this.editing.id = item.id
            this.editing.excludedHeaders = item.excludedheaders.length == 0 ? [] : item.excludedheaders.split('|||')
            this.editing.lockedHeaders = item.lockedheaders.length == 0 ? [] : item.lockedheaders.split('|||')
            this.editing.allowedUsers = item.allowedusers.length == 0 ? [] : item.allowedusers.split('|||')
            }
            catch(err) {
                console.log('Error! - ', err)
                return
            }
        },
        onBlur: function() {
            this.editing.show = false
            console.log('onBlur', this.editing.show)
        },
        removeExcludedHeader: function(item, editing) {
            if (!editing) this.excludedHeaders.splice(this.excludedHeaders.indexOf(item), 1)
            else this.editing.excludedHeaders.splice(this.editing.excludedHeaders.indexOf(item), 1)
        },

        removeAllowedUser: function(item, editing) {
            if (!editing) this.allowedUsers.splice(this.allowedUsers.indexOf(item), 1)
            else this.editing.allowedUsers.splice(this.editing.allowedUsers.indexOf(item), 1)
        },

        removeLockedHeader: function(item, editing) {
            if (!editing) this.lockedHeaders.splice(this.lockedHeaders.indexOf(item), 1)
            else this.editing.lockedHeaders.splice(this.editing.lockedHeaders.indexOf(item), 1)
        }
    }
})