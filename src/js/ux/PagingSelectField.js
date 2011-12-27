var PagingSelectField = Ext.extend(Ext.form.Select, {

	getListPanel: function() {
		var panel = PagingSelectField.superclass.getListPanel.apply(this, arguments),
			list = panel.getComponent('list')
		;

		this.setItemTplWithTitle();
		list.initPlugin(new Ext.plugins.ListPagingPlugin({autoPaging: true}));

		return panel;
	}
});
Ext.reg('pagingselectfield', PagingSelectField);