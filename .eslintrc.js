module.exports = {
	"extends": "airbnb",
	"env": {
		"browser": true,
		"jest": true
	},
	"plugins": ["import"],
	"rules": {
		"arrow-parens": ["error", "always"],
		"padded-blocks": [
			"error",
			{ "classes": "always" }
		],
		"class-methods-use-this": 0,
		"no-param-reassign": 0,
		"no-tabs": 0,
		"no-underscore-dangle": 0,
		"indent": [
			"error",
			"tab",
			{ "SwitchCase": 1 }
		]
	}
};
