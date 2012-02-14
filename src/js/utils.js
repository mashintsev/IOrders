Ext.util.Format.defaultDateFormat = 'd/m/Y';
Date.monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

var getParentInfo = function(field, value) {

	var parentStore = Ext.getStore(field[0].toUpperCase() + field.substring(1));
	var rec = parentStore.getById(value);

	return new Ext.XTemplate(getItemTplMeta(rec.modelName, {useDeps: false}).itemTpl).apply(rec.data);
};

var getItemTplMeta = function(modelName, config) {

	var tableStore = Ext.getStore('tables'),
		tableRecord = tableStore.getById(modelName),
		columnStore = tableRecord.columns(),
		filterObject = config.filterObject,
		groupField = config.groupField,
		useDeps = config.useDeps !== false ? true : false,
		onlyKey = config.onlyKey === true ? true : false
	;
	
	var modelForDeps = undefined;
	
	var templateString = '<div class="hbox {cls}">'
				+		'<div class="data">'
				+			'<tpl if="hasName">'
				+				'<p class="name">\\{name\\}</p>'
				+			'</tpl>'
				+			'<tpl if="!hasName && keyColumnsLength &gt; 0">'
				+				'<p class="key">'
				+					'<tpl for="keyColumns">'
				+						'<tpl if="parent && !parentInfo">'
				+							'<span class="{cls}">\\{{name_br}\\}<tpl if="!end"> : </tpl></span>&nbsp;'
				+						'</tpl>'
				+						'<tpl if="parent && parentInfo">'
				+							'<div class="parent-info">\\{[getParentInfo("{name}", values.{name})]\\}</div>'
				+						'</tpl>'
				+						'<tpl if="!parent">'
				+							'<span class="{cls}">\\{{name}\\}<tpl if="!end"> : </tpl></span>&nbsp;'
				+						'</tpl>'
				+					'</tpl>'
				+				'</p>'
				+			'</tpl>'
				+			'<div class="{[values.keyColumnsLength > 0 ? "other" : ""]}">'
				+				'<tpl if="otherColumnsLength &gt; 0">'
				+					'<small class="other-fields">'
				+						'<tpl for="otherColumns">'
				+							'<tpl if="parent">'
				+								'<tpl if="label || name">'
				+									'<div>'
				+										'<span class="label-parent x-button">'
				+											'<input type="hidden" property="{name}" value="\\{{name}\\}" />'
				+											'{label}'
				+										'</span>'
				+										'<tpl if="name_br">: \\{{name_br}\\}</tpl>'
				+									'</div>'
				+								'</tpl>'
				+							'</tpl>'
				+							'<tpl if="!parent">'
				+								'<tpl if="label || name">'
				+									'<div class="{cls}"><tpl if="name">{name}</tpl></div>'
				+								'</tpl>'
				+							'</tpl>'
				+						'</tpl>'
				+					'</small>'
				+				'</tpl>'
				+			'</div>'
				+		'</div>'
				+		'{buttons}'
				+	'</div>';
	
	var buttons = 
		'<div class="buttons">' 
			+ '<tpl for="deps">'
				+ '<tpl if="count &gt; 0 || extendable">'
				+	'<div class="hbox dep">'
				+ 		'<input type="hidden" value="{id}" />'
				+ 		'<div class="count"><tpl if="count &gt; 0">{count}</tpl></div>'
				+ 		'<div class="stats"><tpl if="stats &gt; 0">{stats}</tpl></div>'
				+ 		'<div class="data">{nameSet}</div>'
				+ 		'<div class="aggregates">{aggregates}</div>'
				+ 		'<tpl if="extendable && (!editing && !contains || editing && contains)"><div class="x-button extend add">+</div></tpl>'
				+ 	'</div>'
				+ '</tpl>'
 			+ '</tpl>'
 		+ '</div>';
	
	var templateData = {
		hasName: false,
		keyColumnsLength: 0,
		keyColumns: [],
		otherColumnsLength: 0,
		otherColumns: [],
		buttons: useDeps && !onlyKey ? buttons : '',
		cls: '<tpl if="needUpload">needUpload</tpl>'
	};
	
	var idColExist = columnStore.findExact('name', 'id') === -1 ? false : true;
	var queryValue = idColExist ? 'parent' : 'key';
	
	if(columnStore.findExact('name', 'name') != -1) {

		templateData.hasName = true;
		queryValue = 'key';
	} else {

		var keyColumns = columnStore.queryBy(function(rec) {
			return rec.get(queryValue)
				&& ( !filterObject || filterObject.modelName.toLowerCase() != rec.get('name').toLowerCase())
				&& groupField !== rec.get('name') ? true : false;
		});

		templateData.keyColumnsLength = keyColumns.getCount(); 

		if(keyColumns.getCount() > 0) {

			var length = keyColumns.getCount(); 

			keyColumns.each(function(col) {

				var parentName = col.get('name')[0].toUpperCase() + col.get('name').substring(1),
					titleCols = undefined,
					parentInfo = keyColumns.getCount() === 1 && !tableRecord.hasIdColumn()
				;

				if(col.get('parent')) {

					titleCols = tableStore.getById(parentName).getTitleColumns();

					length += titleCols.getCount();
				}

				templateData.keyColumns.push({
					parent: col.get('parent') ? true: false,
					name: col.get('name'),
					name_br: col.get('parent') ? parentName + '_name' : col.get('name'),
					parentInfo: parentInfo,
					end: keyColumns.indexOf(col) + 1 >= length
				});

				titleCols && !parentInfo && titleCols.each(function(tCol) {

					templateData.keyColumns.push({
						parent: true,
						cls: 'title',
						name: tCol.get('name'),
						name_br: parentName + '_' + tCol.get('name'),
						parentInfo: false,
						end: titleCols.indexOf(tCol) + keyColumns.indexOf(col) + 2 >= length 
					});
				});
			});
		}
		
		if(keyColumns.getCount() == 1 && !tableRecord.hasIdColumn()) {
			modelForDeps = keyColumns.getAt(0).get('parent');
		}
	}

	if(!onlyKey) {

		var otherColumns = columnStore.queryBy(function(rec) {
			var colName = rec.get('name');
			return !rec.get(queryValue)
				&& ( !groupField || (groupField !== colName
						&& groupField[0].toLowerCase() + groupField.replace('_name', '').substring(1) !== colName)
				)
				&& ( !filterObject || filterObject.modelName.toLowerCase() != rec.get('name').toLowerCase())
				&& colName !== 'id' && colName !== 'name' && rec.get('label') ? true : false;
		});
		
		templateData.otherColumnsLength = otherColumns.getCount(); 
		if(otherColumns.getCount() > 0) {
	
			otherColumns.each(function(col) {
				
				var label = undefined, name = undefined;
	
				var colName = col.get('name');
				switch(col.get('type')) {
	 				case 'boolean' : {
						name = '{[values.' + colName + ' == true ? "' + col.get('label') + '" : ""]}';
						break;
					}
					case 'date' : {
						label = col.get('label');
						name = '<tpl if="' + colName + '">' + label + ' : {[Ext.util.Format.date(values.' + colName + ')]}</tpl>';
						break;
					}
					default : {
						label = col.get('label');
						name = col.get('parent')
							? colName
							: '<tpl if="' + colName + '">' + label + ' : {' + colName + '}</tpl>';
						break;
					}
				}

				var isTitle = col.get('title');

				templateData.otherColumns.push({
					parent: col.get('parent') ? true : false,
					label: label,
					cls: colName === 'processing' ? colName + ' is-{' + colName + '}' : colName + (isTitle ? ' title' : ''),
					name: name,
					name_br: colName[0].toUpperCase() + colName.substring(1) + '_name'
				});

				templateData.cls += (colName === 'processing' ? ' is-{' + colName + '}' : '');

			}); 
		}
	}
	
	return {itemTpl: new Ext.XTemplate(templateString).apply(templateData), modelForDeps: modelForDeps};
};

function getItemTpl (modelName) {

	switch(modelName) {
		case 'Dep': {
			return '<div class="hbox dep <tpl if="loading">loading</tpl>">'
					+	'<div class="count"><tpl if="count &gt; 0">{count}</tpl></div>'
					+	'<div class="stats"><tpl if="stats != \'0\'">{stats}</tpl></div>'
					+	'<div class="data">{nameSet}</div>'
					+	'<div class="aggregates">{aggregates}</div>'
					+	'<tpl if="extendable && (!editing && !contains || editing && contains)"><div class="x-button extend add">+</div></tpl>'
				 + '</div>';
		}
		case 'Debt' : {
			return '<div class="hbox dep">'
					+ '<div class="data">'
					+	'<div>Дата: {[Ext.util.Format.date(values.ddate)]} Документ№: {ndoc} Сумма: {[values.fullSumm]} <tpl if="isWhite">Нужен чек</tpl></div>'
					+	'<div>Остаток задолженности: {[parseFloat(values.remSumm).toFixed(2)]}</div>'
					+ '</div>'
					+ '<div class="encashSumm"><tpl if="encashSumm &gt; 0">{[parseFloat(values.encashSumm).toFixed(2)]}</tpl></div>'
				 + '</div>';
		}
		case 'OfferCategory': {
			return '<div class="<tpl if="lastActive || minLastActive">active</tpl>">{name}</div>'
				 + '<div>'
				   + '<tpl if="minLastActive"><small class="green">[{minLastActive}]</small></tpl>'
				   + '<tpl if="maxLastActive && maxLastActive != minLastActive"><small class="green">[{maxLastActive}]</small></tpl>'
				 + '</div>';
		}
		case 'ShipmentProduct': {
			return '<div class="data">'
				+		'<div class="date">Дата: {[Ext.util.Format.date(values.date)]}</div>'
				+		'<small>'
				+			'<div class="name">Товар: {name}</div>'
				+			'<div class="price">Цена: {price}</div>'
				+			'<div class="volume">Количество: {volume}</div>'
				+		'</small>'
				+	'</div>';
		}
		case 'OfferProduct': {
			return '<div class="hbox<tpl if="lastActive"> active</tpl><tpl if="BonusProgram_tag.search(\'Ф\') != -1"> focused</tpl>">'
			       +'<div class="info {cls} data ' + '<tpl if="stockLevel==1">caution</tpl>' + '">'
				     + '<p>{name}'
						+'<tpl if="extraLabel"><span class="blue"> [{extraLabel}]</span></tpl>'
						+'<tpl if="lastActive"><span class="green"> [{lastActive}]</span></tpl>'
						+'<tpl if="BonusProgram_tag"><span class="crec">{BonusProgram_tag}</span></tpl>'
					 +'</p>'
				     + '<small><span class="price">Цена: {price} руб. </span>'
					   + '<tpl if="rel &gt; 1"><span>Вложение: {rel}; </span></tpl>'
					   + '<span>Кратность: {factor} </span>'
					   + '<span>Стоимость: <span class="cost">{cost}</span></span>'
				     + '</small>'
				   + '</div>'
				   + '<div class="volume">{volume}</div>'
				 + '</div>';
		}
	}
};

var createFieldSet = function(columnsStore, modelName, view) {

	var fsItems = [];

	columnsStore.each(function(column) {
		if (column.get('label') && column.get('name') !== 'processing') {
			var field = {
				name: column.get('name'),
				itemId: column.get('name'),
				label: column.get('label'),
				disabled: !column.get('editable')
			};
			
			var fieldConfig;
			switch(column.get('type')) {
				case 'boolean' : {
					fieldConfig = {
						xtype: 'togglefield',
						listeners: {
							change: function(slider, thumb, newV, oldV) {
								Ext.dispatch({
									controller: 'Navigator',
									action: 'onNavigatorFieldValueChange',
									field: slider,
									newValue: newV,
									oldValue: oldV
								});
							}
						}
					};
					break;
				}
				case 'date' : {
					fieldConfig = {
						xtype: 'datepickerfield',
						picker: {
							yearFrom: 2012,
							yearTo  : 2012,
							slotOrder: ['day', 'month', 'year']
						}
					};
					break;
				}
				default : {
					if(column.get('name') == 'name' && !IOrders.newDesign) {
						var selectStore = createStore(modelName, getSortersConfig(modelName, {}));
						selectStore.load();
						selectStore.add(view.objectRecord);

						fieldConfig = {xtype: 'pagingselectfield', name: 'id', store: selectStore, valueField: 'id', displayField: 'name'};
					} else {
						fieldConfig = {xtype: 'textfield'};
					}
					break;
				}
			}
			
			Ext.apply(field, column.get('parent') 
					? {
						xtype: 'selectfield',
						store: Ext.getStore(column.get('parent')),
						valueField: 'id',
						displayField: 'name',
						onFieldLabelTap: true,
						onFieldInputTap: true,
						getListPanel: function() {
							Ext.form.Select.prototype.getListPanel.apply(this, arguments);

							this.setItemTplWithTitle();

							return this.listPanel;
						}
					} : fieldConfig
			);
			fsItems.push(field);
		}
	});

	return { xtype: 'fieldset', items: fsItems , itemId: 'formFields'};
};

var createFilterField = function(objectRecord) {

	var modelName = objectRecord.modelName;	
	var selectStore = createStore(modelName, getSortersConfig(modelName, {}));
	selectStore.load();
	selectStore.add(objectRecord);

	return {
		xtype: 'fieldset',
		items: {
			xtype: 'filterfield',
			store: selectStore,
			onFieldLabelTap: true,
			onFieldInputTap: true,
			name: 'id',
			label: Ext.getStore('tables').getById(modelName).get('name'),
			valueField: 'id',
			displayField: 'name'
		}
	};
};

function createDepsList(depsStore, tableStore, view) {

	view.depStore = new Ext.data.Store({
		model: 'Dep',
		remoteFilter: false,
		remoteSort: false,
		data: getDepsData(depsStore, tableStore, view),
		countFilter: new Ext.util.Filter({
		    filterFn: function(item) {
		        return item.get('count') > 0 || item.get('extendable');
		    }
		}),
		listeners: {
			update: function(grid, rec) {
				tableStore.getById(rec.getId()).set(rec.data);
			}
		}
	});

	return view.depList = Ext.create({
		xtype: 'list',
		cls: 'x-deps-list',
		scroll: false,
		disableSelection: true,
		itemTpl: getItemTpl('Dep'),
		store: view.depStore
	});
};

var getDepsData = function(depsStore, tablesStore, view, config) {

	var data = [];

	depsStore.each(function(dep) {
		
		var depTable = tablesStore.getById(dep.get('table_id')),
			isSetView = view === undefined && config
		;
		
		if((depTable.get('nameSet') && depTable.get('id') != 'SaleOrderPosition'
				|| (isSetView ? config.record.modelName == 'SaleOrder' : view.objectRecord.modelName == 'SaleOrder'))
		   && (isSetView ? config.record.modelName !== depTable.get('id') : true)) {
			
			depRec = depTable.copy();
			depRec.set('contains', dep.get('contains'));
			depRec.set('editing', view ? view.editing : false);
			
			loadDepData(depRec, depTable, view, config ? Ext.apply(config, {data: data}) : undefined);
			
			if(isSetView) {
				data.push(depRec.data);
			} else {
				data.push(depRec);
			}
		}
	});
	
	return data;
};

var loadDepData = function(depRec, depTable, view, config, force) {

	var modelProxy = Ext.ModelMgr.getModel(depTable.get('id')).prototype.getProxy(),
		filters = [],
		recordForDeps = undefined,
		isSetView = view === undefined && config
	;

	if(view && view.objectRecord.modelName != 'MainMenu') {
		filters.push({
			property: view.objectRecord.modelName.toLowerCase(),
			value: view.objectRecord.getId()
		});
		depRec.set('filtered', true);
	} else if (isSetView) {
		recordForDeps = config.list.modelForDeps && !config.hasIdColumn 
			? Ext.getStore(config.list.modelForDeps).getById(config.record.get(config.list.modelForDeps[0].toLowerCase() + config.list.modelForDeps.substring(1))) 
			: config.record;
		
		if(recordForDeps.modelName != 'MainMenu') {
			filters.push({
				property: recordForDeps.modelName.toLowerCase(),
				value: recordForDeps.getId()
			});
			depRec.set('filtered', true);
		}
	}

	if(!depRec.get('count') || depRec.get('filtered') || depRec.get('expandable') || force) {

		var aggCols = depTable.getAggregates();
		var aggOperation = new Ext.data.Operation({depRec: depRec, filters: filters});
			
		modelProxy.aggregate(aggOperation, function(operation) {
			
			if (aggCols) {
				var aggDepResult = '';
				var aggDepTpl = new Ext.XTemplate('<tpl if="value &gt; 0"><tpl if="name">{name} : </tpl>{[values.value.toFixed(2)]} </tpl>');
				var aggResults = operation.resultSet.records[0].data;
				
				aggCols.each(function(aggCol) {
					aggDepResult += aggDepTpl.apply({name: aggCol.get('label') != depTable.get('nameSet') ? aggCol.get('label') : '', value: aggResults[aggCol.get('name')]});
				});
				
				operation.depRec.set('aggregates', aggDepResult);
			}
			
			operation.depRec.set('count', aggResults.cnt);
			
			if(isSetView) {
				
				config.record.data.deps = config.data;
				config.list.store && config.list.refreshNode(config.list.indexOf(config.record));
				
				config.list.doComponentLayout();
			}
		});
		
		var t = depTable;
		
		if(t && t.columns && t.columns().findBy(function(c){return c.get('name')=='processing';}) > 0) {
			
			filters.push({property: 'processing', value: 'draft'});
			
			var countOperation = new Ext.data.Operation({depRec: depRec, filters: filters});
			modelProxy.aggregate(countOperation, function(operation) {
				
				var aggResults = operation.resultSet.records[0].data;
				operation.depRec.set('stats', aggResults.cnt);
				
				if(isSetView) {
					
					config.record.data.deps = config.data;
					config.list.store && config.list.refreshNode(config.list.indexOf(config.record));
					
					config.list.doComponentLayout();
				}
			});
		}
	}
	
	if(filters.length == 0) {
		depRec.set('filtered', false);
	}
};

var createTitlePanel = function(t) {

	var htmlTpl = new Ext.XTemplate('<div>{title}</div>');
	
	return {
			xtype: 'panel',
			cls: 'x-title-panel',
			html: htmlTpl.apply({title: t})
	};
};

var createNavigatorView = function(rec, oldCard, isSetView, editing, config) {

	var view = Ext.apply({
			xtype: 'navigatorview',
			layout: IOrders.newDesign && rec.get('name') ? {type: 'hbox', pack: 'justify', align: 'stretch'} :
				'fit',
			isObjectView: isSetView ? undefined : true,
			isSetView: isSetView ? true : undefined,
			objectRecord: isSetView ? oldCard.objectRecord : rec,
			tableRecord: isSetView ? rec.get('id') : undefined,
			editing: editing,
			extendable: rec.get('extendable'),
			ownerViewConfig: {
				xtype: oldCard.xtype || 'navigatorview',
				layout: IOrders.newDesign ? {type: 'hbox', pack: 'justify', align: 'stretch'} : 'fit',
				extendable: oldCard.extendable,
				isObjectView: oldCard.isObjectView,
				isSetView: oldCard.isSetView,
				objectRecord: oldCard.objectRecord,
				tableRecord: oldCard.tableRecord,
				ownerViewConfig: oldCard.ownerViewConfig,
				storeLimit: oldCard.isSetView ? oldCard.setViewStore.currentPage * oldCard.setViewStore.pageSize : undefined,
				storePage: oldCard.isSetView && oldCard.setViewStore.currentPage,
				lastSelectedRecord: oldCard.lastSelectedRecord,
				scrollOffset: oldCard.form.scroller && oldCard.form.scroller.getOffset()
			}
		}, config);
		
	return view;
};

var getGroupConfig = function(model) {
	switch(model) {
		case 'EncashmentRequest':
		case 'Shipment':
		case 'SaleOrder' : {
			return {
				getGroupString: function(rec) {
					return Ext.util.Format.date(rec.get('date'));
				},
				sorters: [{property: 'date', direction: 'DESC'}],
				field: 'date'
			};
		}
		case 'Product' : {
			return {
				getGroupString: function(rec) {
					return rec.get('firstName');
				},
				sorters: [{property: 'firstName', direction: 'ASC'}],
				field: 'firstName'
			};
		}
		case 'Category' : {
			return {
				getGroupString: function(rec) {
					return rec.get('ShopDepartment_name');
				},
				sorters: [
					{property: 'ShopDepartment_name', direction: 'ASC'}
				],
				field: 'ShopDepartment_name'
			};
		}
		default : {
			return {};
		}
	}
};

var getSortersConfig = function(model, storeConfig) {

	var table = Ext.getStore('tables').getById(model),
		sortConfig = {sorters: storeConfig.sorters ? storeConfig.sorters : []},
		columns = table.columns()
	;
	
	var parentSort = true;
	
	if (columns.getById(table.getId() + 'datetime')) {
		sortConfig.sorters.push ({ property: 'datetime', direction: 'DESC' });
		parentSort = false;
	}

	if (columns.getById(table.getId() + 'ord')) {
		sortConfig.sorters.push ({ property: 'ord' });
		parentSort = false;
	}
	
	if (columns.getById(table.getId() + 'name')) {
		sortConfig.sorters.push ({ property: 'name' });
		parentSort = false;
	}
	
	if (parentSort) {
		
		var parentColumns = columns.queryBy(function(rec) {
			return rec.get('parent') ? true : false;
		});
		
		parentColumns.each (function(col) {
			columns.findExact('name', col.get('parent') + '_name') != -1
				&& sortConfig.sorters.push({property: col.get('name') + '_name'});
		});
		
	}
	
	return sortConfig;
};

var getNextWorkDay = function() {
	var today = new Date();
	var todayWeekDay = today.getDay();

	var addDays = todayWeekDay >= 5 && todayWeekDay <= 6 ? 7 + 1 - todayWeekDay : 1;
	return today.add(Date.DAY, addDays);
};

var getOwnerViewConfig = function(view) {
	return {ownerViewConfig: {
		xtype: view.xtype,
		layout: IOrders.newDesign ? {type: 'hbox', pack: 'justify', align: 'stretch'} : 'fit',
		extendable: view.extendable,
		isObjectView: view.isObjectView,
		isSetView: view.isSetView,
		objectRecord: view.objectRecord,
		tableRecord: view.tableRecord,
		ownerViewConfig: view.ownerViewConfig,
		storeLimit: view.isSetView ? view.setViewStore.currentPage * view.setViewStore.pageSize : undefined,
		storePage: view.isSetView && view.setViewStore.currentPage,
		lastSelectedRecord: view.lastSelectedRecord,
		scrollOffset: view.form.scroller.getOffset()
	}};
};

var changeBtnText = function(btn) {

	if(btn.altText) {
		var t = btn.text;
		btn.setText(btn.altText);
		btn.altText = t;
	}
};

var unavailBtnFuncMessage = function(btn, view) {

	switch(view.xtype) {
		case 'navigatorview' : {
			switch (btn.name) {
				case 'Edit' : {
					return {
						problem: 'Редактирование запрещено!',
						reason: 'Редактирование возможно только в статусе "Черновик"',
						howFix: 'Для редактирования записи переведите ее в статус "Черновик". Из статусов "Проверка", "На складе" это сделать нельзя.'};
				}
				case 'Delete' : {
					return {
						problem: 'Нельзя удалить запись!',
						reason: 'Удалить запись можно только в статусе "Черновик"',
						howFix: 'Для удаления записи переведите ее в статус "Черновик". Из статусов "Проверка", "На складе" это сделать нельзя.'};
				}
			}
		}
		case 'saleorderview' : {
			
		}
	}
};

var checkRecordInUpload = function(xid) {

	var store = Ext.getStore('ToUpload');
	
	return store && store.findExact('id', xid) !== -1;
};