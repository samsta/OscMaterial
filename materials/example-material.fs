/*{
    "CREDIT": "Do something cool",
    "DESCRIPTION": "describe your material here",
    "TAGS": "template",
    "VSN": "1.0",
    "INPUTS": [ 
		{"LABEL": "Motion X", "NAME": "mat_motion_x", "TYPE": "float", "MIN": -5, "MAX": 5, "DEFAULT": 0.01},
		{"LABEL": "Motion Y", "NAME": "mat_motion_y", "TYPE": "float", "MIN": -5, "MAX": 5, "DEFAULT": 0.01},
		{"LABEL": "Scale", "NAME": "mat_scale", "TYPE": "float", "MIN": 1.0, "MAX": 50.0, "DEFAULT": 1.0 }, 
		{"LABEL": "Threshold", "NAME": "mat_thres", "TYPE": "float", "MIN": -1.0, "MAX": 1.0, "DEFAULT": 0.0 }, 
		{"LABEL": "Edge Thickness", "NAME": "mat_thick", "TYPE": "float", "MIN": 0.01, "MAX": 0.3, "DEFAULT": 0.1},

		{"LABEL": "Layers", "NAME": "mat_layers", "TYPE": "int", "MIN": 1, "MAX": 10, "DEFAULT": 2},
		{"LABEL": "Layer Distance", "NAME": "mat_ldist", "TYPE": "float", "MIN": 0.1, "MAX": 5, "DEFAULT": 1},
        {
  	      "LABEL": "Color/Face",
  	      "NAME": "mat_face_color",
  	      "TYPE": "color",
  	      "DEFAULT": [ 0.15, 0.14, 0.68, 1.0 ],
  	    },
		{
		  "LABEL": "Color/Hue delta", "NAME": "mat_hue_delta", "TYPE": "float", "MIN": -1, "MAX": 1, "DEFAULT": 0.1
		},
		{
		  "LABEL": "Color/Bright factor", "NAME": "mat_bright_fac", "TYPE": "float", "MIN": 0, "MAX": 2, "DEFAULT": 0.9
		},
        {
  	      "LABEL": "Color/Edge",
  	      "NAME": "mat_edge_color",
  	      "TYPE": "color",
  	      "DEFAULT": [ 0.0, 0.0, 0.0, 1.0 ],
  	    },
        {"LABEL": "Base/Noise", "NAME": "mat_noise", "TYPE": "long", "DEFAULT": 0,
          "VALUES": [0, 1, 2, 3, 4, 5, 6, 7, 8],
          "LABELS": ["noise", "vnoise", "worley", "flow", "billowed", "ridged", "fBm", "billowyTurbulence", "ridgedMF"]
        },
		{"LABEL": "Base/Speed", "NAME": "mat_speed", "TYPE": "float", "MIN": -2.0, "MAX": 2.0, "DEFAULT": 1.0 },
		{"LABEL": "Base/Anisotropy", "NAME": "mat_aniso", "TYPE": "float", "MIN": -1.0, "MAX": 1.0, "DEFAULT": 0.0 },
        {"LABEL": "Base/Invert", "NAME": "mat_inv", "TYPE": "bool", "DEFAULT": false},
        {"LABEL": "Mult/Noise", "NAME": "mat_noise2", "TYPE": "long", "DEFAULT": 0,
          "VALUES": [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8],
          "LABELS": ["none", "noise", "vnoise", "worley", "flow", "billowed", "ridged", "fBm", "billowyTurbulence", "ridgedMF"]
        },
		{"LABEL": "Mult/Speed", "NAME": "mat_speed2", "TYPE": "float", "MIN": -2.0, "MAX": 2.0, "DEFAULT": 1.0 },
		{"LABEL": "Mult/Anisotropy", "NAME": "mat_aniso2", "TYPE": "float", "MIN": -1.0, "MAX": 1.0, "DEFAULT": 0.0 },
		{"LABEL": "Mult/Scale", "NAME": "mat_scale_2", "TYPE": "float", "MIN": 0.0, "MAX": 2.0, "DEFAULT": 1.0 },
		{"LABEL": "Mult/Offset", "NAME": "mat_offs", "TYPE": "float", "MIN": -1, "MAX": 1, "DEFAULT": 0},

		{"LABEL": "Texture/Noise", "NAME": "mat_noise3", "TYPE": "long", "DEFAULT": 0,
          "VALUES": [0, 1, 2, 3, 4, 5, 6],
          "LABELS": ["vnoise", "worley", "billowed", "ridged", "fBm", "billowyTurbulence", "ridgedMF"]
        },
        {"LABEL": "Texture/Strength", "NAME": "mat_tex_strength", "TYPE": "float", "MIN": 0, "MAX": 0.1, "DEFAULT": 0.01},
        {"LABEL": "Texture/Scale", "NAME": "mat_tex_scale", "TYPE": "float", "MIN": 0, "MAX": 10, "DEFAULT": 1},
    ],
	"GENERATORS": [
        {"NAME": "mat_time", "TYPE": "time_base", "PARAMS": {"speed": "mat_speed"} },
        {"NAME": "mat_time2", "TYPE": "time_base", "PARAMS": {"speed": "mat_speed2"} },
        {"NAME": "mat_pos_offs_x", "TYPE": "time_base", "PARAMS": {"speed": "mat_motion_x"} },
        {"NAME": "mat_pos_offs_y", "TYPE": "time_base", "PARAMS": {"speed": "mat_motion_y"} },

    ],
}*/

// This fixture only demonstrates the leading MadMapper-style metadata block.
// A real MadMapper .fs file continues with its GLSL shader source here.

