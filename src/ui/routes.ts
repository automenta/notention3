export const routes = [
	{ path: '/', component: 'notention-notes-list', title: 'Notes' },
	{ path: '/notes', component: 'notention-notes-list', title: 'Notes' },
	{ path: '/note', component: 'notention-note-editor', title: 'Note' },
	{
		path: '/ontology',
		component: 'notention-ontology-editor',
		title: 'Ontology',
	},
	{ path: '/network', component: 'notention-network-panel', title: 'Network' },
	{ path: '/settings', component: 'notention-settings', title: 'Settings' },
	{ path: '/contacts', component: 'notention-contact-list', title: 'Contacts' },
	{ path: '/chat', component: 'notention-chat-view', title: 'Chat' },
	{ path: '/profile', component: 'notention-user-profile', title: 'Profile' },
];
