var SaleOrderView = Ext.extend(AbstractView, {
	/**
	 * Config
	 */
	layout: {type: 'hbox', pack: 'justify', align: 'stretch'},
	/**
	 * Own
	 */
	createItems: function() {
		
		var metastore = Ext.getStore ('tables');
		
		this.offerCategoryStore = createStore('OfferCategory', Ext.apply({
			remoteFilter: true,
			filters:[{
				property: 'customer',
				value: this.saleOrder.get('customer')
			}],
			initLastActive: function(productStore, productRecs) {
				
				Ext.each(productRecs, function(product) {
					
					var lastActive = product.get('lastActive');
					
					if(lastActive) {
						
						var category = this.findRecord('category', product.get('category'), undefined, undefined, true, true),
							min = category.get('minLastActive'),
							max = category.get('maxLastActive')
						;
						
						if(!min || min < lastActive) category.set('minLastActive', lastActive);
						if(!max || max < lastActive) category.set('maxLastActive', lastActive);
					}
				}, this);
			}
		}, getGroupConfig('Category')));
		
		this.productCategoryList = Ext.create({
			xtype: 'expandableGroupedList',
			cls: 'x-product-category-list', allowDeselect: false, flex: 1,
			scroll: true,
			store: this.offerCategoryStore,
			itemTpl: getItemTpl('OfferCategory')
		});
		
		this.productCategoryList.on('render', function() {this.scroller.disable();});

		this.productPanel = Ext.create({xtype: 'panel', layout: {type: 'vbox', pack: 'justify', align: 'stretch'}, flex: 3});

		this.items = [this.productCategoryList, this.productPanel];
		
		var summTpl = new Ext.XTemplate(
				'<p>'
			+	'<tpl if="packageName"><small>Упаковка: {packageName}</small></tpl>'
			+	'Сумма заказа: {totalCost}'
			+	'<tpl if="bonusRemains"> Остаток бонуса: <span <tpl if="bonusRemains &lt; 0">class="negative"</tpl> >{bonusRemains}</span></tpl>'
			+	'</p>'
		);
		
		var bb = {
			id: 'bottomToolbar', xtype: 'toolbar', dock: 'bottom',
			items: [
				{xtype: 'spacer'},
				{xtype: 'segmentedbutton', itemId: 'GroupChanger',
					items: [{
							name: 'GroupLastname', itemId: 'GroupLastname', text: 'По производителю', scope: this
						},{
							name: 'GroupFirstname', itemId: 'GroupFirstname', text: 'По наименованию', scope: this, pressed: true
					}]
				},
				{text: this.indexBarMode ? 'Скрыть индекс-бар' : 'Показать индекс-бар', altText: !this.indexBarMode ? 'Скрыть индекс-бар' : 'Показать индекс-бар', itemId: 'ShowIndexBar', name: 'ShowIndexBar', scope: this},
				{text: summTpl.apply({totalCost: 0}), itemId: 'ShowCustomer', name: 'ShowCustomer', scope: this}
			],
			titleTpl: summTpl
		}
		
		if (!metastore.getById('Product').columns().getById('ProductlastName'))
			bb.items[1].disabled = true;
		
		this.dockedItems.push(bb);
		
		this.dockedItems[0].items.push(
			{xtype: 'spacer'},
			{xtype: 'segmentedbutton', allowMultiple: true, itemId: 'ModeChanger',
				items: [
					{itemId: 'Active', text: 'Показать актив', altText: 'Скрыть актив', handler: Ext.emptyFn},
					{itemId: 'Bonus', text: 'По акциям', handler: Ext.emptyFn, disallowOther: ['ShowSaleOrder']},
					{itemId: 'ShowSaleOrder', text: 'Показать заказ', altText: 'Показать все', handler: Ext.emptyFn, disallowOther: ['Bonus']}
				],
				listeners: {
					toggle: function(segBtn, btn, pressed) {

						Ext.dispatch({
							controller: 'SaleOrder',
							action: 'onModeButtonTap',
							view: segBtn.up('saleorderview'),
							segBtn: segBtn,
							btn: btn,
							pressed: pressed
						});
					}
				}
			},
			{ui: 'save', name: 'Save', text: 'Сохранить', scope: this}
		);
	},
	
	/**
	 * Handlers
	 */
	
	onProdCatButtonTap: function() {

		this.productCategoryList.showBy(this.productCategoryBtn, 'fade');
	},
	
	/**
	 * Overridden
	 */
	
	initComponent: function() {

		this.indexBarMode = localStorage.getItem('indexBarMode') == 'true';

		SaleOrderView.superclass.initComponent.apply(this, arguments);
	}
});
Ext.reg('saleorderview', SaleOrderView);